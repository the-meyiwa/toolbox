-- Apply after schema/setup.sql, messaging.sql, supporters.sql and mail_accounts.sql.
-- Rerunnable. This changes access policies; it does not delete user content.
begin;

-- A directory lookup must never grant SELECT on every private profile column.
drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create or replace function public.search_message_profiles(search_query text default '', result_limit integer default 20)
returns table(id uuid, email text, username text, display_name text, avatar_url text, profile_picture text)
language sql stable security definer set search_path = public as $$
  select p.id, null::text, p.username, p.display_name, p.avatar_url, p.profile_picture
  from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid() and p.messaging_enabled = true
    and (nullif(trim(search_query),'') is null
      or strpos(lower(coalesce(p.username,'')), lower(left(trim(search_query),100))) > 0
      or strpos(lower(coalesce(p.display_name,'')), lower(left(trim(search_query),100))) > 0
      -- Exact email lookup supports existing invitations without returning email addresses.
      or lower(p.email) = lower(trim(search_query)))
  order by p.username nulls last, p.id limit greatest(1,least(coalesce(result_limit,20),50));
$$;
revoke all on function public.search_message_profiles(text,integer) from public, anon;
grant execute on function public.search_message_profiles(text,integer) to authenticated;

create or replace function public.list_my_conversations()
returns table(conversation_id uuid, other_id uuid, other_email text, other_username text, other_name text, other_avatar_url text, other_profile_picture text, last_message_at timestamptz)
language sql stable security definer set search_path=public as $$
  select c.id,min(p.id::text)::uuid,null::text,min(p.username),string_agg(coalesce(p.display_name,p.username),' · ' order by coalesce(p.display_name,p.username)),min(p.avatar_url),min(p.profile_picture),max(msg.created_at)
  from public.toolbox_conversations c join public.toolbox_conversation_members mine on mine.conversation_id=c.id and mine.user_id=auth.uid()
  join public.toolbox_conversation_members them on them.conversation_id=c.id and them.user_id<>auth.uid()
  join public.profiles p on p.id=them.user_id left join public.toolbox_messages msg on msg.conversation_id=c.id and msg.expires_at>now()
  group by c.id,c.created_at order by max(msg.created_at) desc nulls last,c.created_at desc;
$$;
create or replace function public.list_conversation_participants(target_conversation_id uuid)
returns table(id uuid,email text,username text,name text,avatar_url text,profile_picture text)
language sql stable security definer set search_path=public as $$
  select p.id,null::text,p.username,p.display_name,p.avatar_url,p.profile_picture from public.toolbox_conversation_members m join public.profiles p on p.id=m.user_id
  where m.conversation_id=target_conversation_id and exists(select 1 from public.toolbox_conversation_members mine where mine.conversation_id=target_conversation_id and mine.user_id=auth.uid());
$$;

-- Approval records are server-written, rather than trusting a JSON approvals array
-- supplied by a participant. Serialize votes so concurrent approvals cannot be lost.
create table if not exists public.toolbox_participant_approvals (
  message_id uuid not null references public.toolbox_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(message_id,user_id)
);
alter table public.toolbox_participant_approvals enable row level security;
revoke all on public.toolbox_participant_approvals from public,anon,authenticated;

create or replace function public.approve_conversation_participant(request_message_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare msg public.toolbox_messages; member_count int; approval_count int; target_id uuid; approved jsonb;
begin
  select * into msg from public.toolbox_messages where id=request_message_id and kind='participant_request' and expires_at>now() for update;
  if auth.uid() is null or msg.id is null or not exists(select 1 from public.toolbox_conversation_members where conversation_id=msg.conversation_id and user_id=auth.uid()) then raise exception 'Request is unavailable'; end if;
  target_id := (msg.payload->>'target_id')::uuid;
  if not exists(select 1 from public.profiles where id=target_id and messaging_enabled=true) then raise exception 'Participant is unavailable'; end if;
  insert into public.toolbox_participant_approvals(message_id,user_id) values(msg.id,auth.uid()) on conflict do nothing;
  -- Sending a request constitutes the sender's approval, but no other claimed votes count.
  insert into public.toolbox_participant_approvals(message_id,user_id)
    select msg.id,msg.sender_id where exists(select 1 from public.toolbox_conversation_members where conversation_id=msg.conversation_id and user_id=msg.sender_id) on conflict do nothing;
  select count(*) into member_count from public.toolbox_conversation_members where conversation_id=msg.conversation_id;
  select count(*),coalesce(jsonb_agg(a.user_id::text),'[]'::jsonb) into approval_count,approved
    from public.toolbox_participant_approvals a join public.toolbox_conversation_members m on m.user_id=a.user_id and m.conversation_id=msg.conversation_id where a.message_id=msg.id;
  update public.toolbox_messages set payload=jsonb_set(msg.payload,'{approvals}',approved,true) where id=msg.id;
  if approval_count < member_count then return false; end if;
  insert into public.toolbox_conversation_members(conversation_id,user_id) values(msg.conversation_id,target_id) on conflict do nothing;
  update public.toolbox_conversations set kind='group' where id=msg.conversation_id;
  return true;
end $$;

create or replace function public.protect_message_fields() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and (new.id,new.conversation_id,new.sender_id,new.kind,new.body,new.created_at,new.expires_at)
      is distinct from (old.id,old.conversation_id,old.sender_id,old.kind,old.body,old.created_at,old.expires_at) then
    raise exception 'Only interactive message state can be changed';
  end if;
  if octet_length(new.payload::text)>1048576 then raise exception 'Message attachment metadata is too large'; end if;
  if tg_op='INSERT' then
    new.created_at := now(); new.expires_at := now() + interval '24 hours';
    if new.kind='participant_request' then new.payload := jsonb_set(new.payload,'{approvals}',jsonb_build_array(new.sender_id::text),true); end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_message_fields on public.toolbox_messages;
create trigger protect_message_fields before insert or update on public.toolbox_messages for each row execute function public.protect_message_fields();
revoke update on public.toolbox_messages from anon,authenticated;
grant update(payload) on public.toolbox_messages to authenticated;
drop policy if exists "Members update interactive messages" on public.toolbox_messages;
drop policy if exists "Members update game messages" on public.toolbox_messages;
create policy "Members update game messages" on public.toolbox_messages for update to authenticated
using (kind='game' and expires_at>now() and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=toolbox_messages.conversation_id and m.user_id=auth.uid()))
with check (kind='game' and expires_at>now() and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id=toolbox_messages.conversation_id and m.user_id=auth.uid()));

-- Stop public downloads of both new and historical attachments.
update storage.buckets set public=false where id='toolbox-files';
insert into storage.buckets(id,name,public,file_size_limit) values('message-files','message-files',false,8388608)
on conflict(id) do update set public=false,file_size_limit=8388608;
drop policy if exists "Members upload message files" on storage.objects;
create policy "Members upload message files" on storage.objects for insert to authenticated with check (
  bucket_id='message-files' and (storage.foldername(name))[2]=auth.uid()::text
  and exists(select 1 from public.toolbox_conversation_members m where m.conversation_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid()));
drop policy if exists "Members read live message files" on storage.objects;
create policy "Members read live message files" on storage.objects for select to authenticated using (
  bucket_id='message-files' and exists(select 1 from public.toolbox_messages msg
    join public.toolbox_conversation_members m on m.conversation_id=msg.conversation_id and m.user_id=auth.uid()
    where msg.kind='file' and msg.expires_at>now() and msg.payload->>'storagePath'=storage.objects.name
      and msg.conversation_id::text=(storage.foldername(storage.objects.name))[1]));
drop policy if exists "Owners remove message files" on storage.objects;
create policy "Owners remove message files" on storage.objects for delete to authenticated using(bucket_id='message-files' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists "Members read legacy live attachments" on storage.objects;
create policy "Members read legacy live attachments" on storage.objects for select to authenticated using (
  bucket_id='toolbox-files' and exists(select 1 from public.toolbox_messages msg
    join public.toolbox_conversation_members m on m.conversation_id=msg.conversation_id and m.user_id=auth.uid()
    where msg.kind='file' and msg.expires_at>now()
      and split_part(msg.payload->>'url','/storage/v1/object/public/toolbox-files/',2)=storage.objects.name
      and msg.sender_id::text=(storage.foldername(storage.objects.name))[1]));

-- Earlier setup scripts granted EXECUTE on every routine, including service-only
-- payment functions. Revoke those grants and only expose intended message RPCs.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('confirm_toolbox_contribution','claim_toolbox_contribution','enable_new_user_messaging','handle_new_user','protect_message_fields')
  loop execute format('revoke all on function %s from public, anon, authenticated',fn.signature); end loop;
end $$;
revoke all on function public.list_my_conversations(), public.list_conversation_participants(uuid), public.approve_conversation_participant(uuid), public.get_or_create_direct_conversation(uuid), public.vote_poll(uuid,int) from public,anon;
grant execute on function public.list_my_conversations(), public.list_conversation_participants(uuid), public.approve_conversation_participant(uuid), public.get_or_create_direct_conversation(uuid), public.vote_poll(uuid,int) to authenticated;
alter function public.handle_new_user() set search_path=public;
drop trigger if exists on_auth_user_auto_confirm on auth.users;
commit;
notify pgrst, 'reload schema';
