-- Toolbox Mail: connected mailbox credentials
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- token_blob holds the OAuth access/refresh tokens encrypted with
-- AES-256-GCM on the server (MAIL_TOKEN_SECRET); the database never
-- sees them in plaintext. Only the server, using the service-role key,
-- reads or writes this table: RLS is on and there are no policies, so
-- the anon and authenticated roles get nothing.

create table if not exists public.mail_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  provider    text not null check (provider in ('google', 'microsoft')),
  email       text not null,
  token_blob  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint mail_accounts_user_provider_email_key unique (user_id, provider, email)
);

create index if not exists mail_accounts_user_id_idx on public.mail_accounts (user_id);

alter table public.mail_accounts enable row level security;

revoke all on table public.mail_accounts from anon, authenticated;
