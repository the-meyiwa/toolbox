-- Run after messaging.sql. Typing contains no draft content and expires after six seconds.
create table if not exists public.toolbox_message_typing (
  conversation_id uuid not null,
  user_id uuid not null,
  expires_at timestamptz not null,
  primary key (conversation_id, user_id),
  foreign key (conversation_id, user_id) references public.toolbox_conversation_members(conversation_id, user_id) on delete cascade
);
alter table public.toolbox_message_typing enable row level security;
create index if not exists toolbox_message_typing_expiry on public.toolbox_message_typing(expires_at);
drop policy if exists "Members see live typing" on public.toolbox_message_typing;
create policy "Members see live typing" on public.toolbox_message_typing for select to authenticated
using (expires_at > now() and exists (
  select 1 from public.toolbox_conversation_members m
  where m.conversation_id = toolbox_message_typing.conversation_id and m.user_id = auth.uid()
));
revoke all on public.toolbox_message_typing from anon, authenticated;
grant select on public.toolbox_message_typing to authenticated;

create or replace function public.set_message_typing(target_conversation_id uuid, is_typing boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from toolbox_conversation_members m where m.conversation_id = target_conversation_id and m.user_id = auth.uid()
  ) then raise exception 'Conversation unavailable'; end if;
  delete from toolbox_message_typing where user_id = auth.uid() and (expires_at <= now() or conversation_id = target_conversation_id);
  if is_typing then
    insert into toolbox_message_typing(conversation_id, user_id, expires_at)
    values (target_conversation_id, auth.uid(), now() + interval '6 seconds')
    on conflict (conversation_id, user_id) do update set expires_at = excluded.expires_at;
  end if;
end $$;
revoke all on function public.set_message_typing(uuid, boolean) from public, anon;
grant execute on function public.set_message_typing(uuid, boolean) to authenticated;
