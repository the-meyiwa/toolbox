import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { createSharedAssistantQuotaStore } from '../../server-assistant-quota.js';

const migration = await readFile(new URL('../../supabase/assistant-quotas.sql', import.meta.url), 'utf8');
export async function createQuotaDatabase(dataDir) {
  const db = await PGlite.create(dataDir ? { dataDir } : {});
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  await db.exec(migration);
  return db;
}
export const quotaMigration = migration;
export async function createQuotaUser(db, email = 'regular@example.test', verified = true) {
  const user = { id: crypto.randomUUID(), email };
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)', [user.id,email,verified ? new Date() : null]);
  return user;
}
export async function quotaRpc(db, userId, name, body) {
  return db.transaction(async tx => {
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon');
    if (userId) await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = name === 'toolbox_assistant_quota'
      ? await tx.query('select public.toolbox_assistant_quota($1,$2::uuid,$3) as value', [body.p_action,body.p_reservation_id || null,body.p_turn_key || null])
      : await tx.query('select public.toolbox_assistant_quota_settle($1::uuid,$2) as value', [body.p_reservation_id,body.p_success]);
    return result.rows[0].value;
  });
}
export function quotaClient(db, user, { afterResponse } = {}) {
  return createSharedAssistantQuotaStore({
    env: { SUPABASE_URL: 'https://quota.example.test', SUPABASE_ANON_KEY: 'offline-key' },
    authorization: `Bearer ${user.id}`,
    fetcher: async (url, options) => {
      const name = new URL(url).pathname.split('/').pop();
      const body = JSON.parse(options.body);
      const value = await quotaRpc(db, options.headers.Authorization ? user.id : null, name, body);
      await afterResponse?.(name,body,value);
      return Response.json(value);
    },
  });
}
