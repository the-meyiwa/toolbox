-- ============================================================
-- TOOLBOX — Complete Supabase Schema (all-in-one)
-- Run this single script in the Supabase SQL Editor.
-- It is fully idempotent: safe to run on a fresh project or
-- re-run on an existing one without conflicts.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 0. EXTENSIONS
-- ════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";


-- ════════════════════════════════════════════════════════════
-- 1. P2P WebRTC SIGNALING
-- ════════════════════════════════════════════════════════════

create table if not exists public.p2p_signals (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  sender_id text not null,
  message_type text not null,
  payload jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.p2p_signals enable row level security;

drop policy if exists "Anyone can insert p2p signals" on public.p2p_signals;
drop policy if exists "Anyone can read p2p signals by room" on public.p2p_signals;

create policy "Anyone can insert p2p signals"
  on public.p2p_signals for insert with check (true);
create policy "Anyone can read p2p signals by room"
  on public.p2p_signals for select using (true);


-- ════════════════════════════════════════════════════════════
-- 2. PROFILES
-- ════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  storage_mode text default 'local' check (storage_mode in ('local', 'supabase')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);


-- ════════════════════════════════════════════════════════════
-- 3. SAVED ARTIFACTS
-- ════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════
-- 4. USER QUOTAS
-- ════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════
-- 5. USER SETTINGS
-- ════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════
-- 6. STORAGE BUCKET (toolbox-files)
-- ════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('toolbox-files', 'toolbox-files', true)
on conflict (id) do nothing;

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


-- ════════════════════════════════════════════════════════════
-- 7. PROFILE TRIGGER (handle_new_user)
-- ════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_name text;
begin
  raw_name := new.raw_user_meta_data->>'full_name';
  if raw_name is null or raw_name = '' then
    raw_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, raw_name)
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'Error in handle_new_user trigger: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ════════════════════════════════════════════════════════════
-- 8. DISABLE AUTO-CONFIRM (email verification required)
-- ════════════════════════════════════════════════════════════

drop trigger if exists on_auth_user_auto_confirm on auth.users;
drop function if exists public.auto_confirm_user();


-- ════════════════════════════════════════════════════════════
-- 9. ASSISTANT CONVERSATIONS
-- ════════════════════════════════════════════════════════════

create table if not exists public.assistant_conversations (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  user_email text,
  username text,
  conversation_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.assistant_conversations enable row level security;

drop policy if exists "Own assistant history: read" on public.assistant_conversations;
drop policy if exists "Own assistant history: insert" on public.assistant_conversations;
drop policy if exists "Own assistant history: update" on public.assistant_conversations;
drop policy if exists "Own assistant history: delete" on public.assistant_conversations;

create policy "Own assistant history: read" on public.assistant_conversations
  for select to authenticated using (auth.uid() = user_id);
create policy "Own assistant history: insert" on public.assistant_conversations
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own assistant history: update" on public.assistant_conversations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own assistant history: delete" on public.assistant_conversations
  for delete to authenticated using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- 10. MAIL ACCOUNTS
-- ════════════════════════════════════════════════════════════

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

-- Server-only table: revoke all client access.
revoke all on table public.mail_accounts from anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- 11. MESSAGING — profile extensions
-- ════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists profile_picture text default 'default';
alter table public.profiles add column if not exists messaging_enabled boolean not null default true;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username)) where username is not null;

-- Backfill usernames for any existing profiles that lack one.
update public.profiles
  set username = lower(regexp_replace(split_part(email,'@',1),'[^a-zA-Z0-9_-]','','g'))
                 || '-' || substr(id::text,1,6)
  where username is null and email is not null;

create or replace function public.enable_new_user_messaging()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles
    set username = coalesce(
          username,
          lower(regexp_replace(split_part(new.email,'@',1),'[^a-zA-Z0-9_-]','','g'))
          || '-' || substr(new.id::text,1,6)),
        messaging_enabled = true
    where id = new.id;
  return new;
end $$;

drop trigger if exists zz_enable_new_user_messaging on auth.users;
create trigger zz_enable_new_user_messaging
  after insert on auth.users
  for each row execute procedure public.enable_new_user_messaging();

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles"
  on public.profiles for select to authenticated
  using (messaging_enabled = true or auth.uid() = id);


-- ════════════════════════════════════════════════════════════
-- 12. MESSAGING — conversations, members, messages
-- ════════════════════════════════════════════════════════════

create table if not exists public.toolbox_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_at timestamptz not null default now()
);

create table if not exists public.toolbox_conversation_members (
  conversation_id uuid references public.toolbox_conversations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.toolbox_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.toolbox_conversations on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  body text not null default '',
  kind text not null default 'text',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (char_length(body) <= 2000)
);

alter table public.toolbox_messages drop constraint if exists toolbox_messages_kind_check;
alter table public.toolbox_messages
  add constraint toolbox_messages_kind_check
  check (kind in ('text','file','game','poll','participant_request'));

create index if not exists toolbox_messages_conversation_created
  on public.toolbox_messages(conversation_id, created_at);

alter table public.toolbox_conversations enable row level security;
alter table public.toolbox_conversation_members enable row level security;
alter table public.toolbox_messages enable row level security;


-- ════════════════════════════════════════════════════════════
-- 13. MESSAGING — RLS policies
-- ════════════════════════════════════════════════════════════

drop policy if exists "Members see conversations" on public.toolbox_conversations;
create policy "Members see conversations" on public.toolbox_conversations
  for select to authenticated
  using (exists(
    select 1 from public.toolbox_conversation_members m
    where m.conversation_id = id and m.user_id = auth.uid()
  ));

drop policy if exists "Members see members" on public.toolbox_conversation_members;
drop policy if exists "Members see own memberships" on public.toolbox_conversation_members;
create policy "Members see own memberships" on public.toolbox_conversation_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Members read live messages" on public.toolbox_messages;
create policy "Members read live messages" on public.toolbox_messages
  for select to authenticated
  using (
    expires_at > now()
    and exists(
      select 1 from public.toolbox_conversation_members m
      where m.conversation_id = toolbox_messages.conversation_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members send messages" on public.toolbox_messages;
create policy "Members send messages" on public.toolbox_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists(
      select 1 from public.toolbox_conversation_members m
      where m.conversation_id = toolbox_messages.conversation_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members update interactive messages" on public.toolbox_messages;
drop policy if exists "Members update game messages" on public.toolbox_messages;
create policy "Members update interactive messages" on public.toolbox_messages
  for update to authenticated
  using (
    kind in ('game','poll')
    and expires_at > now()
    and exists(
      select 1 from public.toolbox_conversation_members m
      where m.conversation_id = toolbox_messages.conversation_id
        and m.user_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 14. MESSAGING — RPC functions
-- ════════════════════════════════════════════════════════════

create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null or other_user_id = auth.uid() then
    raise exception 'Invalid participant';
  end if;

  select c.id into cid
    from toolbox_conversations c
    where c.kind = 'direct'
      and (select count(*) from toolbox_conversation_members m where m.conversation_id = c.id) = 2
      and exists(select 1 from toolbox_conversation_members m where m.conversation_id = c.id and m.user_id = auth.uid())
      and exists(select 1 from toolbox_conversation_members m where m.conversation_id = c.id and m.user_id = other_user_id)
    limit 1;

  if cid is null then
    insert into toolbox_conversations default values returning id into cid;
    insert into toolbox_conversation_members(conversation_id, user_id)
      values (cid, auth.uid()), (cid, other_user_id);
  end if;

  return cid;
end $$;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;


create or replace function public.list_my_conversations()
returns table(
  conversation_id uuid, other_id uuid, other_email text, other_username text,
  other_name text, other_avatar_url text, other_profile_picture text,
  last_message_at timestamptz
) language sql security definer set search_path = public as $$
  select c.id,
         min(p.id::text)::uuid,
         min(p.email),
         min(p.username),
         string_agg(coalesce(p.display_name, p.username), ' · ' order by coalesce(p.display_name, p.username)),
         min(p.avatar_url),
         min(p.profile_picture),
         max(msg.created_at)
    from toolbox_conversations c
    join toolbox_conversation_members mine on mine.conversation_id = c.id and mine.user_id = auth.uid()
    join toolbox_conversation_members them on them.conversation_id = c.id and them.user_id <> auth.uid()
    join profiles p on p.id = them.user_id
    left join toolbox_messages msg on msg.conversation_id = c.id and msg.expires_at > now()
   group by c.id, c.created_at
   order by max(msg.created_at) desc nulls last, c.created_at desc;
$$;
grant execute on function public.list_my_conversations() to authenticated;


create or replace function public.list_conversation_participants(target_conversation_id uuid)
returns table(id uuid, email text, username text, name text, avatar_url text, profile_picture text)
language sql security definer set search_path = public as $$
  select p.id, p.email, p.username, p.display_name, p.avatar_url, p.profile_picture
    from toolbox_conversation_members m
    join profiles p on p.id = m.user_id
   where m.conversation_id = target_conversation_id
     and exists(
       select 1 from toolbox_conversation_members mine
       where mine.conversation_id = target_conversation_id and mine.user_id = auth.uid()
     );
$$;
grant execute on function public.list_conversation_participants(uuid) to authenticated;


drop function if exists public.add_approved_conversation_participant(uuid);

create or replace function public.approve_conversation_participant(request_message_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  msg toolbox_messages;
  member_count int;
  approval_count int;
  target_id uuid;
begin
  select * into msg from toolbox_messages
    where id = request_message_id and kind = 'participant_request' and expires_at > now()
    for update;

  if msg.id is null
    or not exists(select 1 from toolbox_conversation_members where conversation_id = msg.conversation_id and user_id = auth.uid())
  then raise exception 'Request is unavailable'; end if;

  target_id := (msg.payload->>'target_id')::uuid;

  if not (coalesce(msg.payload->'approvals','[]'::jsonb) @> to_jsonb(array[auth.uid()::text])) then
    update toolbox_messages
      set payload = jsonb_set(
            msg.payload,
            '{approvals}',
            coalesce(msg.payload->'approvals','[]'::jsonb) || to_jsonb(auth.uid()::text),
            true)
      where id = msg.id
      returning * into msg;
  end if;

  select count(*) into member_count from toolbox_conversation_members where conversation_id = msg.conversation_id;
  select count(distinct value::uuid) into approval_count
    from jsonb_array_elements_text(coalesce(msg.payload->'approvals','[]'::jsonb));

  if approval_count < member_count then return false; end if;

  insert into toolbox_conversation_members(conversation_id, user_id)
    values (msg.conversation_id, target_id)
    on conflict do nothing;
  update toolbox_conversations set kind = 'group' where id = msg.conversation_id;

  return true;
end $$;
grant execute on function public.approve_conversation_participant(uuid) to authenticated;


create or replace function public.vote_poll(poll_message_id uuid, option_index int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  msg toolbox_messages;
  opts jsonb;
  me jsonb := to_jsonb(auth.uid()::text);
  n int; i int;
  voters jsonb;
  had boolean;
  result jsonb;
begin
  select * into msg from toolbox_messages
    where id = poll_message_id and kind = 'poll' and expires_at > now()
    for update;

  if msg.id is null
    or not exists(select 1 from toolbox_conversation_members where conversation_id = msg.conversation_id and user_id = auth.uid())
  then raise exception 'This poll is no longer available'; end if;

  opts := coalesce(msg.payload->'options','[]'::jsonb);
  n := jsonb_array_length(opts);
  if option_index is null or option_index < 0 or option_index >= n then
    raise exception 'That option does not exist';
  end if;

  had := coalesce(opts->option_index->'voters','[]'::jsonb) @> jsonb_build_array(me);

  for i in 0..n-1 loop
    select coalesce(jsonb_agg(v),'[]'::jsonb) into voters
      from jsonb_array_elements(coalesce(opts->i->'voters','[]'::jsonb)) v
      where v <> me;
    if i = option_index and not had then
      voters := voters || jsonb_build_array(me);
    end if;
    opts := jsonb_set(opts, array[i::text], jsonb_set(opts->i, '{voters}', voters, true));
  end loop;

  update toolbox_messages
    set payload = jsonb_set(msg.payload, '{options}', opts, true)
    where id = msg.id
    returning payload into result;

  return result;
end $$;
grant execute on function public.vote_poll(uuid, int) to authenticated;


-- ════════════════════════════════════════════════════════════
-- 15. SUPPORTER CONTRIBUTIONS
-- ════════════════════════════════════════════════════════════

create table if not exists public.toolbox_contributions (
  tx_ref text primary key,
  user_id uuid references auth.users(id) on delete set null,
  currency text not null check (currency in ('NGN','USD','CAD','GBP')),
  amount numeric(16,2) not null check (amount > 0),
  supporter_threshold numeric(16,2) not null check (supporter_threshold > 0),
  transaction_id text unique,
  paid_amount numeric(16,2),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

-- Migration: allow anonymous contributions (user_id nullable).
alter table public.toolbox_contributions alter column user_id drop not null;

create index if not exists toolbox_contribution_user on public.toolbox_contributions(user_id);

create table if not exists public.toolbox_supporters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_style text not null default 'classic'
    check (profile_style in ('classic','etched','halo','orbit')),
  early_access boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.toolbox_supporter_previews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  url text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.toolbox_contributions enable row level security;
alter table public.toolbox_supporters enable row level security;
alter table public.toolbox_supporter_previews enable row level security;

-- Server-only tables: revoke client access, grant service_role.
revoke all on public.toolbox_contributions,
            public.toolbox_supporters,
            public.toolbox_supporter_previews
  from anon, authenticated;

grant all on public.toolbox_contributions,
            public.toolbox_supporters,
            public.toolbox_supporter_previews
  to service_role;


-- ════════════════════════════════════════════════════════════
-- 16. SUPPORTER RPC FUNCTIONS
-- ════════════════════════════════════════════════════════════

create or replace function public.confirm_toolbox_contribution(
  p_reference text, p_transaction_id text, p_paid_amount numeric
) returns void language plpgsql security invoker set search_path = public as $$
declare
  contribution toolbox_contributions%rowtype;
begin
  select * into contribution from toolbox_contributions where tx_ref = p_reference for update;
  if not found then raise exception 'Unknown contribution'; end if;

  if contribution.verified_at is not null then
    if contribution.transaction_id <> p_transaction_id then
      raise exception 'Transaction mismatch';
    end if;
    return;
  end if;

  if p_paid_amount < contribution.amount or p_transaction_id is null then
    raise exception 'Invalid payment';
  end if;

  update toolbox_contributions
    set transaction_id = p_transaction_id,
        paid_amount = p_paid_amount,
        verified_at = now()
    where tx_ref = p_reference;

  if contribution.user_id is not null and p_paid_amount >= contribution.supporter_threshold then
    insert into toolbox_supporters(user_id) values(contribution.user_id)
      on conflict(user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.confirm_toolbox_contribution(text, text, numeric) from public, anon, authenticated;
grant execute on function public.confirm_toolbox_contribution(text, text, numeric) to service_role;


create or replace function public.claim_toolbox_contribution(p_reference text, p_user_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  contribution toolbox_contributions%rowtype;
begin
  select * into contribution from toolbox_contributions where tx_ref = p_reference for update;
  if not found or contribution.verified_at is null then
    raise exception 'Verified contribution not found';
  end if;
  if contribution.user_id is not null and contribution.user_id <> p_user_id then
    raise exception 'Contribution already claimed';
  end if;

  update toolbox_contributions set user_id = p_user_id where tx_ref = p_reference;

  if contribution.paid_amount >= contribution.supporter_threshold then
    insert into toolbox_supporters(user_id) values(p_user_id)
      on conflict(user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.claim_toolbox_contribution(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_toolbox_contribution(text, uuid) to service_role;


-- ════════════════════════════════════════════════════════════
-- 17. PERMISSIONS
-- ════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;
grant all privileges on all routines in schema public to anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- 18. RELOAD POSTGREST SCHEMA CACHE
-- ════════════════════════════════════════════════════════════

notify pgrst, 'reload schema';
