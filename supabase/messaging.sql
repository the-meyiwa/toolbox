-- Toolbox Messages: authenticated directory, 24-hour chats, files and game state.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists profile_picture text default 'default';
alter table public.profiles add column if not exists messaging_enabled boolean not null default true;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
update public.profiles set username = lower(regexp_replace(split_part(email,'@',1),'[^a-zA-Z0-9_-]','','g')) || '-' || substr(id::text,1,6) where username is null and email is not null;
create or replace function public.enable_new_user_messaging() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update profiles set username=coalesce(username,lower(regexp_replace(split_part(new.email,'@',1),'[^a-zA-Z0-9_-]','','g')) || '-' || substr(new.id::text,1,6)), messaging_enabled=true where id=new.id;
  return new;
end $$;
drop trigger if exists zz_enable_new_user_messaging on auth.users;
create trigger zz_enable_new_user_messaging after insert on auth.users for each row execute procedure public.enable_new_user_messaging();
drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles" on public.profiles for select to authenticated using (messaging_enabled = true or auth.uid() = id);

create table if not exists public.toolbox_conversations (
  id uuid primary key default gen_random_uuid(), kind text not null default 'direct' check (kind in ('direct','group')),
  created_at timestamptz not null default now()
);
create table if not exists public.toolbox_conversation_members (
  conversation_id uuid references public.toolbox_conversations on delete cascade,
  user_id uuid references auth.users on delete cascade, joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create table if not exists public.toolbox_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid references public.toolbox_conversations on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null, body text not null default '',
  kind text not null default 'text' check (kind in ('text','file','game')), payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '24 hours'),
  check (char_length(body) <= 2000)
);
create index if not exists toolbox_messages_conversation_created on public.toolbox_messages(conversation_id,created_at);
alter table public.toolbox_conversations enable row level security;
alter table public.toolbox_conversation_members enable row level security;
alter table public.toolbox_messages enable row level security;
drop policy if exists "Members see conversations" on public.toolbox_conversations;
create policy "Members see conversations" on public.toolbox_conversations for select to authenticated using (exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=id and m.user_id=auth.uid()));
drop policy if exists "Members see members" on public.toolbox_conversation_members;
create policy "Members see own memberships" on public.toolbox_conversation_members for select to authenticated using (user_id=auth.uid());
drop policy if exists "Members read live messages" on public.toolbox_messages;
create policy "Members read live messages" on public.toolbox_messages for select to authenticated using (expires_at > now() and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
drop policy if exists "Members send messages" on public.toolbox_messages;
create policy "Members send messages" on public.toolbox_messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
drop policy if exists "Members update game messages" on public.toolbox_messages;
create policy "Members update game messages" on public.toolbox_messages for update to authenticated using (kind='game' and expires_at > now() and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));

create or replace function public.get_or_create_direct_conversation(other_user_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if auth.uid() is null or other_user_id=auth.uid() then raise exception 'Invalid participant'; end if;
  select c.id into cid from toolbox_conversations c
  where c.kind='direct' and (select count(*) from toolbox_conversation_members m where m.conversation_id=c.id)=2
    and exists(select 1 from toolbox_conversation_members m where m.conversation_id=c.id and m.user_id=auth.uid())
    and exists(select 1 from toolbox_conversation_members m where m.conversation_id=c.id and m.user_id=other_user_id) limit 1;
  if cid is null then insert into toolbox_conversations default values returning id into cid;
    insert into toolbox_conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,other_user_id); end if;
  return cid;
end $$;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.list_my_conversations() returns table(conversation_id uuid, other_id uuid, other_email text, other_username text, other_name text, other_avatar_url text, other_profile_picture text, last_message_at timestamptz) language sql security definer set search_path=public as $$
  select c.id,p.id,p.email,p.username,p.display_name,p.avatar_url,p.profile_picture,max(msg.created_at)
  from toolbox_conversations c join toolbox_conversation_members mine on mine.conversation_id=c.id and mine.user_id=auth.uid()
  join toolbox_conversation_members them on them.conversation_id=c.id and them.user_id<>auth.uid()
  join profiles p on p.id=them.user_id left join toolbox_messages msg on msg.conversation_id=c.id and msg.expires_at>now()
  group by c.id,p.id,p.email,p.username,p.display_name,p.avatar_url,p.profile_picture order by max(msg.created_at) desc nulls last,c.created_at desc;
$$;
grant execute on function public.list_my_conversations() to authenticated;
