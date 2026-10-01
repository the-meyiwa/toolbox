import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/messaging.sql', 'utf8');

test('Messages SQL: message policies check the message\'s own conversation', () => {
  // Unqualified, conversation_id inside the members subquery is the member row's own column: always true.
  assert.ok(!/m\.conversation_id\s*=\s*conversation_id\b/.test(sql), 'a policy compares the member row with itself');
  const policies = sql.match(/create policy "[^"]+" on public\.toolbox_messages[^;]+;/g) || [];
  assert.equal(policies.length, 3);
  for (const p of policies) assert.match(p, /m\.conversation_id=toolbox_messages\.conversation_id/);
});

test('Messages SQL: poll votes are recorded atomically on the server', () => {
  assert.match(sql, /create or replace function public\.vote_poll\(poll_message_id uuid, option_index int\)/);
  assert.match(sql, /for update;/, 'the poll row is locked while the vote is applied');
  assert.match(sql, /grant execute on function public\.vote_poll\(uuid,int\) to authenticated/);
});

test('Messages: a vote uses the atomic vote_poll RPC and refuses databases without it', async () => {
  const store = new Map([['toolbox_supabase_session', JSON.stringify({ id: 'me', token: 't', email: 'me@x.io' })]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { votePoll } = await import('../../js/lib/messaging-service.js');
  const poll = { question: 'Lunch?', options: [{ text: 'Pizza', voters: ['you'] }, { text: 'Rice', voters: [] }] };
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${String(url).replace(/^.*\/rest\/v1\//, '')}`);
    if (String(url).includes('rpc/vote_poll')) return new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.vote_poll' }), { status: 404 });
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify([{ id: 'm1', payload: body.payload }]), { status: 200 });
  };
  await assert.rejects(() => votePoll('m1', 1, poll), /latest Messages database update/);
  assert.deepEqual(calls, ['POST rpc/vote_poll'], 'a client-side patch could overwrite concurrent votes');
  globalThis.fetch = async () => new Response(JSON.stringify({ options: [{ text: 'Pizza', voters: ['you'] }, { text: 'Rice', voters: ['me'] }] }), { status: 200 });
  const next = await votePoll('m1', 1, poll);
  assert.deepEqual(next.options.map(o => o.voters), [['you'], ['me']]);
});
