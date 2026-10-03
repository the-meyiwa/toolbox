-- Toolbox Admin. Run once in the Supabase SQL editor; rerunnable, and nothing existing is changed.
-- Needs supabase/supporters.sql (contributions) to have been run first.
--
-- Only the Toolbox owner (a verified email in toolbox_private.admin_owners) can list users and
-- contributions, or give people access to private tools. Every function checks the caller's own
-- signed-in session inside the database, so nothing the browser sends can widen what it sees.
-- A private tool appears only for the owner and for the Toolbox users it has been given to.
begin;

create schema if not exists toolbox_private;
revoke all on schema toolbox_private from public, anon, authenticated;

create table if not exists toolbox_private.admin_owners (
  email text primary key check (email = lower(email))
);
-- The owner's accounts (the same ones the sign-in code gives the reserved @madselkie name).
insert into toolbox_private.admin_owners(email)
values ('meyigbenee@gmail.com'), ('meyigbenee@icloud.com'), ('laoluwaabiodun1@gmail.com')
on conflict do nothing;

-- Columns the admin lists read, for databases set up before they existed.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists profile_picture text default 'default';

-- Who may open which private tool. Toolbox Admin itself is never shared.
create table if not exists toolbox_private.admin_tool_grants (
  tool_id text not null check (tool_id ~ '^[a-z0-9][a-z0-9-]{0,63}$' and tool_id <> 'toolbox-admin'),
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (tool_id, user_id)
);
create index if not exists admin_tool_grants_user on toolbox_private.admin_tool_grants(user_id);

alter table toolbox_private.admin_owners enable row level security;
alter table toolbox_private.admin_tool_grants enable row level security;
revoke all on toolbox_private.admin_owners, toolbox_private.admin_tool_grants from public, anon, authenticated;

create or replace function toolbox_private.is_admin_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join toolbox_private.admin_owners o on o.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

create or replace function toolbox_private.require_owner()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not toolbox_private.is_admin_owner() then
    raise exception 'Only the Toolbox owner can do this.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function toolbox_private.is_admin_owner(), toolbox_private.require_owner() from public, anon, authenticated;

-- What the signed-in person may open: every private tool for the owner, otherwise what they were given.
create or replace function public.my_admin_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'owner', toolbox_private.is_admin_owner(),
    'tools', coalesce((select jsonb_agg(g.tool_id order by g.tool_id)
                         from toolbox_private.admin_tool_grants g where g.user_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform toolbox_private.require_owner();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'new7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'supporters', (select count(*) from public.toolbox_supporters),
    'contributions', (select count(*) from public.toolbox_contributions where verified_at is not null),
    'pending', (select count(*) from public.toolbox_contributions where verified_at is null),
    'totals', coalesce((select jsonb_object_agg(t.currency, t.total) from (
        select c.currency, sum(coalesce(c.paid_amount, c.amount)) as total
          from public.toolbox_contributions c where c.verified_at is not null group by c.currency) t), '{}'::jsonb),
    'grants', (select count(*) from toolbox_private.admin_tool_grants),
    'signups', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day) from (
        select date_trunc('day', created_at)::date as day, count(*) as n
          from auth.users where created_at > now() - interval '30 days' group by 1) d), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_list_users(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns table(id uuid, email text, username text, display_name text, avatar_url text, profile_picture text,
              created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, provider text,
              supporter boolean, contributed jsonb, tools text[], total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  perform toolbox_private.require_owner();
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  select u.id, u.email::text, p.username, p.display_name, p.avatar_url, p.profile_picture,
         u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
         coalesce(u.raw_app_meta_data->>'provider', 'email'),
         exists (select 1 from public.toolbox_supporters s where s.user_id = u.id),
         coalesce((select jsonb_object_agg(c.currency, c.total) from (
             select x.currency, sum(coalesce(x.paid_amount, x.amount)) as total
               from public.toolbox_contributions x where x.user_id = u.id and x.verified_at is not null group by x.currency) c), '{}'::jsonb),
         coalesce((select array_agg(g.tool_id order by g.tool_id) from toolbox_private.admin_tool_grants g where g.user_id = u.id), '{}'::text[]),
         count(*) over ()
    from auth.users u
    left join public.profiles p on p.id = u.id
   where q = '' or lower(u.email) like '%' || q || '%' or lower(coalesce(p.username, '')) like '%' || q || '%'
      or lower(coalesce(p.display_name, '')) like '%' || q || '%'
   order by u.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_contributions(p_limit integer default 100, p_offset integer default 0)
returns table(tx_ref text, user_id uuid, email text, username text, currency text, amount numeric, paid_amount numeric,
              verified boolean, created_at timestamptz, verified_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform toolbox_private.require_owner();
  return query
  select c.tx_ref, c.user_id, u.email::text, p.username, c.currency, c.amount::numeric, c.paid_amount::numeric,
         (c.verified_at is not null), c.created_at, c.verified_at, count(*) over ()
    from public.toolbox_contributions c
    left join auth.users u on u.id = c.user_id
    left join public.profiles p on p.id = c.user_id
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_grants()
returns table(tool_id text, user_id uuid, email text, username text, display_name text, granted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform toolbox_private.require_owner();
  return query
  select g.tool_id, g.user_id, u.email::text, p.username, p.display_name, g.granted_at
    from toolbox_private.admin_tool_grants g
    join auth.users u on u.id = g.user_id
    left join public.profiles p on p.id = g.user_id
   order by g.tool_id, g.granted_at desc;
end;
$$;

-- Give a private tool to another Toolbox user, found by email, @username or id.
-- Only real, verified accounts can be given access.
create or replace function public.admin_grant_tool(p_tool text, p_who text)
returns table(tool_id text, user_id uuid, email text, username text, display_name text, granted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  who text := lower(trim(coalesce(p_who, '')));
  target uuid;
begin
  perform toolbox_private.require_owner();
  if p_tool is null or p_tool !~ '^[a-z0-9][a-z0-9-]{0,63}$' or p_tool = 'toolbox-admin' then
    raise exception 'That tool cannot be shared.' using errcode = '22023';
  end if;
  if who = '' then raise exception 'Enter the person''s email or username.' using errcode = '22023'; end if;
  select u.id into target
    from auth.users u left join public.profiles p on p.id = u.id
   where u.email_confirmed_at is not null
     and (lower(u.email) = who or lower(coalesce(p.username, '')) = ltrim(who, '@') or u.id::text = who)
   limit 1;
  if target is null then
    raise exception 'No Toolbox account with a verified email matches "%".', trim(p_who) using errcode = 'P0002';
  end if;
  if target = auth.uid() then raise exception 'You already have every private tool.' using errcode = '22023'; end if;
  insert into toolbox_private.admin_tool_grants(tool_id, user_id) values (p_tool, target) on conflict do nothing;
  return query
  select g.tool_id, g.user_id, u.email::text, p.username, p.display_name, g.granted_at
    from toolbox_private.admin_tool_grants g
    join auth.users u on u.id = g.user_id
    left join public.profiles p on p.id = g.user_id
   where g.tool_id = p_tool and g.user_id = target;
end;
$$;

create or replace function public.admin_revoke_tool(p_tool text, p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform toolbox_private.require_owner();
  delete from toolbox_private.admin_tool_grants g where g.tool_id = p_tool and g.user_id = p_user;
  return found;
end;
$$;

revoke all on function public.my_admin_access(), public.admin_overview(),
  public.admin_list_users(text, integer, integer), public.admin_list_contributions(integer, integer),
  public.admin_list_grants(), public.admin_grant_tool(text, text), public.admin_revoke_tool(text, uuid)
  from public, anon;
grant execute on function public.my_admin_access(), public.admin_overview(),
  public.admin_list_users(text, integer, integer), public.admin_list_contributions(integer, integer),
  public.admin_list_grants(), public.admin_grant_tool(text, text), public.admin_revoke_tool(text, uuid)
  to authenticated;

commit;

-- Make the API see the new functions straight away (otherwise it can keep answering "not found").
notify pgrst, 'reload schema';
