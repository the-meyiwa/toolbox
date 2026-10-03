import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const read = (f) => readFile(new URL(`../../supabase/${f}`, import.meta.url), 'utf8');

async function database() {
  const db = await PGlite.create();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email varchar(255), email_confirmed_at timestamptz,
      created_at timestamptz default now(), last_sign_in_at timestamptz, raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.profiles(id uuid primary key references auth.users on delete cascade, email text, username text,
      display_name text, avatar_url text, profile_picture text);
  `);
  await db.exec(await read('supporters.sql'));
  await db.exec(await read('admin.sql'));
  return db;
}

async function user(db, email, { verified = true, username = null } = {}) {
  const id = crypto.randomUUID();
  await db.query('insert into auth.users(id, email, email_confirmed_at) values($1, $2, $3)', [id, email, verified ? new Date() : null]);
  await db.query('insert into public.profiles(id, email, username) values($1, $2, $3)', [id, email, username]);
  return id;
}

/** Runs SQL as a signed-in person, the way PostgREST does. */
async function as(db, id, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(id ? 'set local role authenticated' : 'set local role anon');
    if (id) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return (await tx.query(sql, params)).rows;
  });
}

test('only the verified owner can read users and contributions', async () => {
  const db = await database();
  const owner = await user(db, 'Meyigbenee@icloud.com', { username: 'madselkie' });
  const someone = await user(db, 'ada@lovelace.dev', { username: 'ada' });
  await db.query("insert into public.toolbox_contributions(tx_ref, user_id, currency, amount, supporter_threshold, paid_amount, verified_at) values('tx1', $1, 'USD', 5, 5, 5, now())", [someone]);

  const [{ admin_overview: o }] = await as(db, owner, 'select public.admin_overview()');
  assert.equal(o.users, 2);
  assert.equal(o.contributions, 1);
  assert.equal(Number(o.totals.USD), 5);

  const users = await as(db, owner, "select * from public.admin_list_users('ada')");
  assert.equal(users.length, 1);
  assert.equal(users[0].username, 'ada');
  assert.equal(Number(users[0].total), 1);
  const contributions = await as(db, owner, 'select * from public.admin_list_contributions()');
  assert.equal(contributions[0].email, 'ada@lovelace.dev');

  await assert.rejects(as(db, someone, 'select public.admin_overview()'), /Only the Toolbox owner/);
  await assert.rejects(as(db, someone, 'select * from public.admin_list_users()'), /Only the Toolbox owner/);
  await assert.rejects(as(db, null, 'select * from public.admin_list_contributions()'), /permission denied/);
  // The tables themselves are out of reach.
  await assert.rejects(as(db, someone, 'select * from toolbox_private.admin_tool_grants'), /permission denied/);
});

test('an unverified owner address is not the owner', async () => {
  const db = await database();
  const fake = await user(db, 'meyigbenee@gmail.com', { verified: false });
  const [{ my_admin_access: a }] = await as(db, fake, 'select public.my_admin_access()');
  assert.equal(a.owner, false);
  await assert.rejects(as(db, fake, 'select public.admin_overview()'), /Only the Toolbox owner/);
});

test('private tools are given to real Toolbox users, by email or @username, and taken back', async () => {
  const db = await database();
  const owner = await user(db, 'meyigbenee@gmail.com');
  const ada = await user(db, 'ada@lovelace.dev', { username: 'ada' });
  const pending = await user(db, 'new@person.dev', { verified: false, username: 'newbie' });

  let [{ my_admin_access: mine }] = await as(db, ada, 'select public.my_admin_access()');
  assert.deepEqual(mine, { owner: false, tools: [] });

  const [g] = await as(db, owner, "select * from public.admin_grant_tool('study', '@Ada')");
  assert.equal(g.user_id, ada);
  [{ my_admin_access: mine }] = await as(db, ada, 'select public.my_admin_access()');
  assert.deepEqual(mine.tools, ['study']);
  // Granting again is harmless.
  await as(db, owner, "select * from public.admin_grant_tool('study', 'ada@lovelace.dev')");
  assert.equal((await as(db, owner, 'select * from public.admin_list_grants()')).length, 1);

  await assert.rejects(as(db, owner, "select * from public.admin_grant_tool('study', 'nobody@nowhere.dev')"), /No Toolbox account/);
  await assert.rejects(as(db, owner, "select * from public.admin_grant_tool('study', 'newbie')"), /No Toolbox account/);
  await assert.rejects(as(db, owner, "select * from public.admin_grant_tool('toolbox-admin', 'ada')"), /cannot be shared/);
  await assert.rejects(as(db, ada, "select * from public.admin_grant_tool('study', 'ada')"), /Only the Toolbox owner/);
  assert.ok(pending);

  const [{ admin_revoke_tool: gone }] = await as(db, owner, 'select public.admin_revoke_tool($1, $2)', ['study', ada]);
  assert.equal(gone, true);
  [{ my_admin_access: mine }] = await as(db, ada, 'select public.my_admin_access()');
  assert.deepEqual(mine.tools, []);
  const [{ my_admin_access: own }] = await as(db, owner, 'select public.my_admin_access()');
  assert.equal(own.owner, true);
});

test('the migration can be run again', async () => {
  const db = await database();
  await db.exec(await read('admin.sql'));
  const rows = (await db.query('select count(*)::int as n from toolbox_private.admin_owners')).rows;
  assert.equal(rows[0].n, 2);
});
