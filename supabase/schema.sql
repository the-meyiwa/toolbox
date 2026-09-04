-- ============================================================
-- TOOLBOX — Supabase PostgreSQL Schema & Security Policies
-- Run this script in the Supabase SQL Editor (SQL -> New Query)
-- ============================================================

-- P2P WebRTC Signaling Table
CREATE TABLE IF NOT EXISTS public.p2p_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  sender_id text NOT NULL,
  message_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  storage_mode text default 'local' check (storage_mode in ('local', 'supabase')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger to create profile automatically on auth.users sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. SAVED ARTIFACTS TABLE (For Supabase Cloud Storage Sync)
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

create policy "Users can manage own artifacts"
  on public.saved_artifacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. USER QUOTAS TABLE (For Multi-Device Quota Sync)
create table if not exists public.user_quotas (
  user_id uuid references auth.users on delete cascade primary key,
  date_key text not null,
  messages_count int default 0,
  heavy_tasks_count int default 0,
  large_files_count int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_quotas enable row level security;

create policy "Users can manage own quotas"
  on public.user_quotas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. STORAGE BUCKET CONFIGURATION (toolbox-files)
insert into storage.buckets (id, name, public)
values ('toolbox-files', 'toolbox-files', true)
on conflict (id) do nothing;

create policy "Users can upload their own files"
  on storage.objects for insert
  with check (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own files"
  on storage.objects for select
  using (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own files"
  on storage.objects for delete
  using (bucket_id = 'toolbox-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- 5. USER SETTINGS TABLE (For syncing application settings)
create table if not exists public.user_settings (
  user_id uuid references auth.users on delete cascade primary key,
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_settings enable row level security;

create policy "Users can manage own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
