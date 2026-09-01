-- ============================================================
-- TOOLBOX — Supabase PostgreSQL All-In-One Schema & Security Policies
-- Run this script in the Supabase SQL Editor (SQL -> New Query)
-- It is designed to be idempotent and safe to run multiple times.
-- ============================================================

-- 0. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 1. P2P WebRTC Signaling Table
create table if not exists public.p2p_signals (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  sender_id text not null,
  message_type text not null,
  payload jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- We don't necessarily need RLS on p2p_signals since room_code acts as a capability URL,
-- but we could enable it for anon access. For now, we leave it as is (publicly accessible via REST if anon key used).
alter table public.p2p_signals enable row level security;
drop policy if exists "Anyone can insert p2p signals" on public.p2p_signals;
drop policy if exists "Anyone can read p2p signals by room" on public.p2p_signals;
create policy "Anyone can insert p2p signals" on public.p2p_signals for insert with check (true);
create policy "Anyone can read p2p signals by room" on public.p2p_signals for select using (true);


-- 2. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  storage_mode text default 'local' check (storage_mode in ('local', 'supabase')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Drop existing policies if they exist so we can recreate them
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- 3. SAVED ARTIFACTS TABLE
create table if not exists public.saved_artifacts (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  kind text not null,
  from_tool text,
  tags text[] default '{}',
  storage_url text,
  payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_saved_artifacts_user on public.saved_artifacts(user_id);
create index if not exists idx_saved_artifacts_kind on public.saved_artifacts(kind);

alter table public.saved_artifacts enable row level security;

drop policy if exists "Users can manage own artifacts" on public.saved_artifacts;
create policy "Users can manage own artifacts"
  on public.saved_artifacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 4. USER QUOTAS TABLE
create table if not exists public.user_quotas (
  user_id uuid references auth.users on delete cascade primary key,
  date_key text not null,
  messages_count int default 0,
  heavy_tasks_count int default 0,
  large_files_count int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_quotas enable row level security;

drop policy if exists "Users can manage own quotas" on public.user_quotas;
create policy "Users can manage own quotas"
  on public.user_quotas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 5. USER SETTINGS TABLE
create table if not exists public.user_settings (
  user_id uuid references auth.users on delete cascade primary key,
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can manage own settings" on public.user_settings;
create policy "Users can manage own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 6. STORAGE BUCKET CONFIGURATION (toolbox-files)
-- Ensure storage bucket exists
insert into storage.buckets (id, name, public)
values ('toolbox-files', 'toolbox-files', true)
on conflict (id) do nothing;

-- Update RLS policies for storage bucket
drop policy if exists "Users can upload their own files" on storage.objects;
drop policy if exists "Users can view their own files" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;

create policy "Users can upload their own files"
  on storage.objects for insert
  with check (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own files"
  on storage.objects for select
  using (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own files"
  on storage.objects for delete
  using (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);


-- 7. TRIGGERS AND FUNCTIONS (Robust handle_new_user)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_name text;
begin
  -- Safely extract full_name, fallback to email prefix if not present or null
  raw_name := new.raw_user_meta_data->>'full_name';
  if raw_name is null or raw_name = '' then
    raw_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, raw_name)
  -- If profile already exists, do nothing (to avoid breaking on double execution)
  on conflict (id) do nothing;
  
  return new;
exception when others then
  -- In case of an unexpected error, log it but do NOT fail the auth.users insert
  -- Failing here prevents the user from signing up at all!
  raise warning 'Error in handle_new_user trigger: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- Drop and recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 8. AUTO-CONFIRM TRIGGER & EXISTING ACCOUNT MIGRATION
-- Ensures newly created accounts and existing accounts can authenticate immediately
-- without being blocked by unconfirmed email state or SMTP rate limits.
create or replace function public.auto_confirm_user()
returns trigger as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  new.confirmed_at := coalesce(new.confirmed_at, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute procedure public.auto_confirm_user();

-- Ensure all existing accounts are marked as confirmed so they can log in immediately
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmed_at = coalesce(confirmed_at, now())
where email_confirmed_at is null;


-- 9. GRANT PERMISSIONS
-- Ensure anon and authenticated roles have appropriate permissions on the public schema
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;
grant all privileges on all routines in schema public to anon, authenticated;
