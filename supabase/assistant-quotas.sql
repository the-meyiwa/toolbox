-- Durable Assistant quotas. Run once in the Toolbox Supabase SQL editor before
-- deploying the gateway change. Rerunnable; existing user content is untouched.
begin;

create schema if not exists toolbox_private;
revoke all on schema toolbox_private from public, anon, authenticated;

create table if not exists toolbox_private.assistant_quota_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null,
  messages_count integer not null default 0 check (messages_count >= 0),
  requests_count integer not null default 0 check (requests_count >= 0)
);
create table if not exists toolbox_private.assistant_quota_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  turn_key text,
  started_at timestamptz not null,
  last_at timestamptz not null,
  steps integer not null default 1 check (steps >= 0),
  counted boolean not null default true
);
create index if not exists assistant_quota_turn_lookup
  on toolbox_private.assistant_quota_turns(user_id, usage_day, turn_key, last_at);
create index if not exists assistant_quota_turn_burst
  on toolbox_private.assistant_quota_turns(user_id, started_at) where counted;

-- The random receipt id is also a server-held settlement capability. Neither this
-- table nor its ids may be exposed to users, logs, analytics or the browser.
create table if not exists toolbox_private.assistant_quota_reservations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid not null references toolbox_private.assistant_quota_turns(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  charged boolean not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed'))
);
create index if not exists assistant_quota_reservation_burst
  on toolbox_private.assistant_quota_reservations(user_id, created_at);
create index if not exists assistant_quota_reservation_turn
  on toolbox_private.assistant_quota_reservations(turn_id, status);

-- Optional additional unlimited accounts are administered in SQL, not localStorage
-- or client parameters. Existing verified owner emails also retain their access.
create table if not exists toolbox_private.assistant_quota_exemptions (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table toolbox_private.assistant_quota_accounts enable row level security;
alter table toolbox_private.assistant_quota_turns enable row level security;
alter table toolbox_private.assistant_quota_reservations enable row level security;
alter table toolbox_private.assistant_quota_exemptions enable row level security;
revoke all on all tables in schema toolbox_private from public, anon, authenticated;

create or replace function toolbox_private.assistant_quota_summary(p_user uuid, p_now timestamptz, p_unlimited boolean)
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object(
    'isUnlimited', p_unlimited, 'messagesUsed', a.messages_count,
    'messagesLimit', case when p_unlimited then null else 50 end,
    'messagesRemaining', case when p_unlimited then null else greatest(0, 50-a.messages_count) end,
    'burstRemaining', case when p_unlimited then null else greatest(0, 10-(select count(*) from toolbox_private.assistant_quota_turns t where t.user_id=p_user and t.counted and t.started_at>p_now-interval '1 minute')) end,
    'requestsUsed', a.requests_count,
    'requestsRemaining', case when p_unlimited then null else greatest(0, 400-a.requests_count) end,
    'resetsAt', to_char((a.usage_day+1)::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
    'storage', 'shared'
  ) from toolbox_private.assistant_quota_accounts a where a.user_id=p_user;
$$;

create or replace function public.toolbox_assistant_quota(
  p_action text, p_reservation_id uuid default null, p_turn_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_now timestamptz; v_day date; v_unlimited boolean;
  v_account toolbox_private.assistant_quota_accounts;
  v_turn toolbox_private.assistant_quota_turns;
  v_receipt toolbox_private.assistant_quota_reservations;
  v_recent integer; v_oldest timestamptz; v_removed integer; v_charged boolean;
  v_reason text; v_retry integer := 0;
begin
  if v_user is null then raise exception 'Sign in to Toolbox first.' using errcode='42501'; end if;
  if p_action not in ('summary','reserve') or p_action is null then raise exception 'Invalid quota operation'; end if;
  if p_action='reserve' and (p_reservation_id is null or (p_turn_key is not null and p_turn_key !~ '^[A-Za-z0-9_-]{8,128}:[a-f0-9]{64}$')) then raise exception 'Invalid quota reservation'; end if;

  -- A row lock serializes this user's operations across every gateway instance.
  -- Different users proceed independently. Compute the day after acquiring it.
  insert into toolbox_private.assistant_quota_accounts(user_id, usage_day)
    values(v_user, (clock_timestamp() at time zone 'UTC')::date) on conflict do nothing;
  select * into v_account from toolbox_private.assistant_quota_accounts where user_id=v_user for update;
  v_now := clock_timestamp(); v_day := (v_now at time zone 'UTC')::date;
  if v_account.usage_day <> v_day then
    update toolbox_private.assistant_quota_accounts set usage_day=v_day,messages_count=0,requests_count=0 where user_id=v_user;
  end if;
  select exists(select 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null and lower(u.email) in ('meyigbenee@gmail.com','meyigbenee@icloud.com'))
    or exists(select 1 from toolbox_private.assistant_quota_exemptions where user_id=v_user) into v_unlimited;

  -- Refund abandoned pending replies, but never refund provider work attempts.
  -- The lease is longer than the gateway's maximum reply duration.
  update toolbox_private.assistant_quota_reservations set status='failed'
    where user_id=v_user and status='pending' and expires_at<=v_now;
  update toolbox_private.assistant_quota_turns t set steps=(select count(*) from toolbox_private.assistant_quota_reservations r where r.turn_id=t.id and r.status<>'failed')
    where t.user_id=v_user and t.counted;
  select count(*) into v_removed from toolbox_private.assistant_quota_turns where user_id=v_user and counted and steps=0 and usage_day=v_day;
  update toolbox_private.assistant_quota_accounts set messages_count=greatest(0,messages_count-v_removed) where user_id=v_user;
  update toolbox_private.assistant_quota_turns set counted=false where user_id=v_user and counted and steps=0;
  delete from toolbox_private.assistant_quota_turns where user_id=v_user and usage_day<v_day-2;
  select * into v_account from toolbox_private.assistant_quota_accounts where user_id=v_user;

  if p_action='summary' then return toolbox_private.assistant_quota_summary(v_user,v_now,v_unlimited); end if;
  select * into v_receipt from toolbox_private.assistant_quota_reservations where id=p_reservation_id;
  if found then
    -- Retrying a timed-out reserve must return the same receipt without charging twice.
    if v_receipt.user_id<>v_user or v_receipt.status<>'pending' then raise exception 'Reservation unavailable'; end if;
    select * into v_turn from toolbox_private.assistant_quota_turns where id=v_receipt.turn_id;
    if v_turn.turn_key is distinct from p_turn_key then raise exception 'Reservation does not match this task'; end if;
    return jsonb_build_object('allowed',true,'charged',v_receipt.charged,'reservationId',v_receipt.id,'summary',toolbox_private.assistant_quota_summary(v_user,v_now,v_unlimited));
  end if;
  if p_turn_key is not null then
    select * into v_turn from toolbox_private.assistant_quota_turns where user_id=v_user and usage_day=v_day and turn_key=p_turn_key and counted
      and last_at>v_now-interval '30 minutes' order by last_at desc limit 1;
  end if;
  if not v_unlimited and v_account.requests_count>=400 then
    v_reason := 'Daily Assistant work limit reached. It resets at midnight UTC.';
    v_retry := ceil(extract(epoch from ((v_day+1)::timestamp at time zone 'UTC')-v_now));
  else
    select count(*),min(created_at) into v_recent,v_oldest from toolbox_private.assistant_quota_reservations where user_id=v_user and created_at>v_now-interval '1 minute';
    if not v_unlimited and v_recent>=40 then
      v_reason := 'The Assistant is handling too many steps. Please wait a minute and try again.';
      v_retry := ceil(extract(epoch from v_oldest+interval '1 minute'-v_now));
    elsif v_turn.id is not null and v_turn.steps>=32 then
      v_reason := 'This Assistant task has used its available steps. Start a new message.';
    elsif v_turn.id is null and not v_unlimited and v_account.messages_count>=50 then
      v_reason := 'Daily Assistant message limit reached. It resets at midnight UTC.';
      v_retry := ceil(extract(epoch from ((v_day+1)::timestamp at time zone 'UTC')-v_now));
    elsif v_turn.id is null and not v_unlimited then
      select count(*),min(started_at) into v_recent,v_oldest from toolbox_private.assistant_quota_turns where user_id=v_user and counted and started_at>v_now-interval '1 minute';
      if v_recent>=10 then
        v_reason := 'Too many Assistant messages in one minute. Please wait and try again.';
        v_retry := ceil(extract(epoch from v_oldest+interval '1 minute'-v_now));
      end if;
    end if;
  end if;
  if v_reason is not null then return jsonb_build_object('allowed',false,'status',429,'reason',v_reason,'retryAfter',greatest(0,v_retry)); end if;

  v_charged := v_turn.id is null;
  if v_charged then
    insert into toolbox_private.assistant_quota_turns(user_id,usage_day,turn_key,started_at,last_at)
      values(v_user,v_day,p_turn_key,v_now,v_now) returning * into v_turn;
    update toolbox_private.assistant_quota_accounts set messages_count=messages_count+1 where user_id=v_user;
  else
    update toolbox_private.assistant_quota_turns set steps=steps+1,last_at=v_now where id=v_turn.id;
  end if;
  update toolbox_private.assistant_quota_accounts set requests_count=requests_count+1 where user_id=v_user;
  insert into toolbox_private.assistant_quota_reservations(id,user_id,turn_id,created_at,expires_at,charged)
    values(p_reservation_id,v_user,v_turn.id,v_now,v_now+interval '15 minutes',v_charged);
  return jsonb_build_object('allowed',true,'charged',v_charged,'reservationId',p_reservation_id,'summary',toolbox_private.assistant_quota_summary(v_user,v_now,v_unlimited));
end;
$$;

-- Settlement uses an unpredictable UUID capability generated by the Node server.
-- It does not require an unexpired JWT, cannot enumerate receipts or target a user,
-- and returns no account data. A caller may only settle a receipt whose secret it knows.
create or replace function public.toolbox_assistant_quota_settle(p_reservation_id uuid, p_success boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_receipt toolbox_private.assistant_quota_reservations; v_turn toolbox_private.assistant_quota_turns; v_now timestamptz;
begin
  if p_reservation_id is null or p_success is null then return false; end if;
  select user_id into v_user from toolbox_private.assistant_quota_reservations where id=p_reservation_id;
  if v_user is null then return false; end if;
  -- Always acquire the account lock before a receipt/turn lock to avoid deadlocks.
  perform 1 from toolbox_private.assistant_quota_accounts where user_id=v_user for update;
  select * into v_receipt from toolbox_private.assistant_quota_reservations where id=p_reservation_id;
  if not found or v_receipt.status='failed' or (p_success and v_receipt.status<>'pending') then return false; end if;
  v_now := clock_timestamp();
  if p_success and v_receipt.expires_at>v_now then
    update toolbox_private.assistant_quota_reservations set status='succeeded' where id=p_reservation_id;
    return true;
  end if;
  update toolbox_private.assistant_quota_reservations set status='failed' where id=p_reservation_id;
  update toolbox_private.assistant_quota_turns set steps=greatest(0,steps-1) where id=v_receipt.turn_id returning * into v_turn;
  if v_turn.counted and v_turn.steps=0 then
    update toolbox_private.assistant_quota_turns set counted=false where id=v_turn.id;
    -- A late refund belongs to its original day, never to the next day's counters.
    update toolbox_private.assistant_quota_accounts set messages_count=greatest(0,messages_count-1)
      where user_id=v_user and usage_day=v_turn.usage_day;
  end if;
  return not p_success;
end;
$$;

revoke all on function toolbox_private.assistant_quota_summary(uuid,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.toolbox_assistant_quota(text,uuid,text) from public,anon,authenticated;
grant execute on function public.toolbox_assistant_quota(text,uuid,text) to authenticated;
revoke all on function public.toolbox_assistant_quota_settle(uuid,boolean) from public,anon,authenticated;
grant execute on function public.toolbox_assistant_quota_settle(uuid,boolean) to anon,authenticated;

commit;
notify pgrst, 'reload schema';
