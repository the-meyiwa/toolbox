import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createQuotaDatabase, createQuotaUser, quotaClient, quotaRpc, quotaMigration } from '../helpers/assistant-quota-db.js';
import { assistantTurnKey, createSharedAssistantQuotaStore } from '../../server-assistant-quota.js';

const db = await createQuotaDatabase();
after(() => db.close());
const prompt = (id, content = 'Help me plan this') => ({ turnId: `turn_shared_${id}`, messages: [{ role: 'user', content }] });

test('Shared quota migration can be safely rerun', async () => { await db.exec(quotaMigration); });

test('Two gateway instances share one atomic burst quota', async () => {
  const user = await createQuotaUser(db);
  const clients = [quotaClient(db,user),quotaClient(db,user)];
  const attempts = await Promise.all(Array.from({ length:24 }, (_,i) => clients[i%2].reserve(user,prompt(i))));
  assert.equal(attempts.filter(r => r.allowed).length,8);
  assert.equal(attempts.filter(r => r.status===429).length,16);
  assert.equal((await clients[0].summary()).messagesUsed,8);
  assert.equal((await clients[1].summary()).messagesUsed,8);
});

test('Concurrent steps stay one message when the first step fails and another succeeds', async () => {
  const user = await createQuotaUser(db);
  const one = quotaClient(db,user); const two = quotaClient(db,user);
  const first = await one.reserve(user,prompt('concurrent'));
  const followup = await two.reserve(user,prompt('concurrent'));
  assert.equal(first.charged,true); assert.equal(followup.charged,false);
  assert.equal(await two.commit(user,followup),true);
  assert.equal(await one.release(user,first),true);
  assert.equal(await two.release(user,first),false);
  assert.equal((await two.summary()).messagesUsed,1);
  assert.equal((await two.reserve(user,prompt('concurrent'))).charged,false);
});

test('Ambiguous network failure retries a reservation exactly once', async () => {
  const user = await createQuotaUser(db); let lost = false; const ids=[];
  const client = quotaClient(db,user,{ afterResponse(name,body) {
    if (name!=='toolbox_assistant_quota') return;
    ids.push(body.p_reservation_id);
    if (!lost) { lost=true; throw new TypeError('Simulated response lost after transaction commit'); }
  } });
  const receipt = await client.reserve(user,prompt('retry'));
  assert.equal(receipt.allowed,true); assert.equal(ids.length,2); assert.equal(ids[0],ids[1]);
  const summary = await quotaClient(db,user).summary();
  assert.equal(summary.messagesUsed,1); assert.equal(summary.requestsUsed,1);
});

test('Quota identity, clock, owner privileges and tables cannot be changed by callers', async () => {
  const ordinary = await createQuotaUser(db); const owner = await createQuotaUser(db,'meyigbenee@gmail.com');
  const unconfirmed = await createQuotaUser(db,'meyigbenee@icloud.com',false);
  assert.equal((await quotaClient(db,owner).summary()).isUnlimited,true);
  assert.equal((await quotaClient(db,unconfirmed).summary()).isUnlimited,false);
  const forgedUser = { ...owner };
  const realClient = quotaClient(db,ordinary);
  await realClient.reserve(forgedUser,prompt('identity'));
  assert.equal((await realClient.summary()).messagesUsed,1);
  assert.equal((await quotaClient(db,owner).summary()).messagesUsed,0);
  await assert.rejects(quotaRpc(db,null,'toolbox_assistant_quota',{ p_action:'summary' }),/permission denied/);
  for (const sql of [
    'select * from toolbox_private.assistant_quota_reservations',
    `insert into toolbox_private.assistant_quota_exemptions values('${ordinary.id}')`,
    'update toolbox_private.assistant_quota_accounts set messages_count=0',
    `select toolbox_private.assistant_quota_summary('${ordinary.id}',now(),true)`,
  ]) await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.exec(sql); }),/permission denied/);
  assert.equal(await quotaRpc(db,null,'toolbox_assistant_quota_settle',{ p_reservation_id:crypto.randomUUID(),p_success:false }),false);
  assert.equal((await realClient.summary()).messagesUsed,1);
});

test('An expired user session can settle only the server-held receipt and cannot refund twice', async () => {
  const user = await createQuotaUser(db); const client=quotaClient(db,user);
  const first=await client.reserve(user,prompt('settle'));
  const second=await client.reserve(user,prompt('separate'));
  await client.commit(user,second);
  assert.equal(await quotaRpc(db,null,'toolbox_assistant_quota_settle',{ p_reservation_id:first.reservationId,p_success:false }),true);
  assert.equal(await quotaRpc(db,null,'toolbox_assistant_quota_settle',{ p_reservation_id:first.reservationId,p_success:false }),false);
  assert.equal((await client.summary()).messagesUsed,1);
});

test('A server crash expires pending charges without refunding successful replies or work attempts', async () => {
  const user = await createQuotaUser(db); const client=quotaClient(db,user);
  const pending=await client.reserve(user,prompt('crash'));
  const succeeded=await client.reserve(user,prompt('succeeded'));
  await client.commit(user,succeeded);
  await db.query("update toolbox_private.assistant_quota_reservations set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",[user.id]);
  const summary=await client.summary();
  assert.equal(summary.messagesUsed,1); assert.equal(summary.requestsUsed,2);
  assert.equal(await client.release(user,pending),false);
  assert.equal((await client.reserve(user,prompt('crash'))).charged,true);
});

test('A refund from yesterday cannot subtract from today and burst windows span midnight', async () => {
  const user = await createQuotaUser(db); const client=quotaClient(db,user);
  const old=await client.reserve(user,prompt('yesterday'));
  await db.query("update toolbox_private.assistant_quota_turns set usage_day=usage_day-1 where user_id=$1",[user.id]);
  await db.query("update toolbox_private.assistant_quota_accounts set usage_day=usage_day-1 where user_id=$1",[user.id]);
  const current=await client.reserve(user,prompt('today'));
  await client.commit(user,current);
  await client.release(user,old);
  assert.equal((await client.summary()).messagesUsed,1);
  const other=await createQuotaUser(db); const more=quotaClient(db,other);
  for(let i=0;i<8;i++) await more.commit(other,await more.reserve(other,prompt(`midnight_${i}`)));
  await db.query("update toolbox_private.assistant_quota_turns set usage_day=usage_day-1 where user_id=$1",[other.id]);
  await db.query("update toolbox_private.assistant_quota_accounts set usage_day=usage_day-1 where user_id=$1",[other.id]);
  assert.equal((await more.reserve(other,prompt('midnight_extra'))).status,429);
  assert.equal((await more.summary()).messagesUsed,0);
});

test('Daily, turn and work limits remain enforced across gateway instances', async () => {
  const user=await createQuotaUser(db); const client=quotaClient(db,user);
  for(let i=0;i<16;i++) await client.commit(user,await client.reserve(user,prompt('steps')));
  assert.match((await client.reserve(user,prompt('steps'))).reason,/available steps/);
  for(let i=0;i<8;i++) await client.commit(user,await client.reserve(user,prompt('othersteps')));
  assert.match((await quotaClient(db,user).reserve(user,prompt('work'))).reason,/too many steps/);
  const daily=await createQuotaUser(db); const another=quotaClient(db,daily);
  for(let i=0;i<40;i++) {
    assert.equal(await another.commit(daily,await another.reserve(daily,prompt(`daily_${i}`))),true);
    await db.query("update toolbox_private.assistant_quota_turns set started_at=clock_timestamp()-interval '2 minutes' where user_id=$1",[daily.id]);
    await db.query("update toolbox_private.assistant_quota_reservations set created_at=clock_timestamp()-interval '2 minutes' where user_id=$1",[daily.id]);
  }
  assert.match((await quotaClient(db,daily).reserve(daily,prompt('daily_extra'))).reason,/message limit/);
  await db.query('update toolbox_private.assistant_quota_accounts set requests_count=150 where user_id=$1',[daily.id]);
  assert.match((await another.reserve(daily,prompt('daily_49'))).reason,/work limit/);
});

test('The confirmed owner can run one task past the per-task step cap', async () => {
  const owner=await createQuotaUser(db,'meyigbenee@gmail.com'); const client=quotaClient(db,owner);
  for(let i=0;i<45;i++) {
    const receipt=await client.reserve(owner,prompt('owner_long_task'));
    assert.equal(receipt.allowed,true);
    await client.commit(owner,receipt);
  }
  assert.equal((await client.summary()).messagesUsed,1);
});

test('Failed provider attempts refund messages but cannot bypass the work rate limit', async () => {
  const user=await createQuotaUser(db); const client=quotaClient(db,user);
  for(let i=0;i<20;i++) await client.release(user,await client.reserve(user,prompt(`failed_${i}`)));
  assert.equal((await client.summary()).messagesUsed,0);
  assert.equal((await client.summary()).requestsUsed,20);
  assert.match((await client.reserve(user,prompt('retry_more'))).reason,/too many steps/);
});

test('Turn fingerprints use the current message even when history contains old tool calls', () => {
  const history=[{ role:'user',content:'Old task' },{ role:'assistant',tool_calls:[{}] },{ role:'tool',content:'Old result' }];
  const current={ turnId:'turn_history_1',messages:[...history,{ role:'user',content:'Current task' }] };
  assert.equal(assistantTurnKey(current),assistantTurnKey({ ...current,messages:[{ role:'user',content:'Current task' }] }));
  assert.notEqual(assistantTurnKey(current),assistantTurnKey({ ...current,messages:[...history,{ role:'user',content:'Different task' }] }));
});

test('Shared store failure blocks provider access instead of silently resetting quotas', async () => {
  let requests=0;
  const client=createSharedAssistantQuotaStore({ env:{ SUPABASE_URL:'https://quota.example.test',SUPABASE_ANON_KEY:'test' },authorization:'Bearer token',fetcher:async () => { requests++; return new Response('Unavailable',{ status:503 }); } });
  await assert.rejects(client.reserve({},prompt('offline')),error => error.status===503);
  assert.equal(requests,2);
  const broken=createSharedAssistantQuotaStore({ env:{},fetcher:async () => { throw new Error('must not call'); } });
  await assert.rejects(broken.summary(),error => error.status===503);
});

test('Quota counters and successful turns survive a full database restart', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'toolbox-quota-'));
  let durable;
  try {
    durable=await createQuotaDatabase(directory);
    const user=await createQuotaUser(durable); const client=quotaClient(durable,user);
    await client.commit(user,await client.reserve(user,prompt('persistent')));
    await durable.close(); durable=await PGlite.create({ dataDir:directory });
    const restarted=quotaClient(durable,user);
    assert.equal((await restarted.summary()).messagesUsed,1);
    assert.equal((await restarted.reserve(user,prompt('persistent'))).charged,false);
  } finally {
    await durable?.close();
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
    await rm(directory,{ recursive:true,force:true });
  }
});
