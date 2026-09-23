-- Toolbox Assistant: chat history synced across devices.
-- One row per user holding their conversation list (JSON).
-- Safe to run more than once.

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

-- Make the new table visible to the REST API straight away.
notify pgrst, 'reload schema';
