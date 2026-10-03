-- Toolbox Admin: health check. Paste all of this into a new Supabase SQL Editor query and run it.
-- It changes nothing in your database: the helper below lives in pg_temp (it disappears when
-- the query ends) and every call it makes is read-only. The notify line only asks the API to
-- refresh its list of functions, which is harmless.
--
-- The result is a table: one row per check, with OK / FAIL / WARN and what to do about it.

create or replace function pg_temp.toolbox_admin_check()
returns table(step int, check_name text, status text, detail text, fix text)
language plpgsql as $$
declare
  fn text;
  missing text[] := '{}';
  col text;
  missing_cols text[] := '{}';
  owner_row record;
  other_id uuid;
  found_owner boolean := false;
  verified_owner boolean := false;
  res jsonb;
  cnt bigint;
begin
  -- 1. Schema and tables
  step := 1; check_name := 'Private schema and tables';
  if to_regclass('toolbox_private.admin_owners') is not null and to_regclass('toolbox_private.admin_tool_grants') is not null then
    status := 'OK'; detail := 'toolbox_private.admin_owners and admin_tool_grants exist'; fix := null;
  else
    status := 'FAIL';
    detail := 'The admin tables are missing, so admin.sql did not finish. Schema toolbox_private '
      || coalesce((select 'exists (owner ' || pg_get_userbyid(nspowner) || '), tables in it: '
                   || coalesce((select string_agg(relname, ', ' order by relname) from pg_class where relnamespace = n.oid and relkind = 'r'), 'none')
                   from pg_namespace n where nspname = 'toolbox_private'), 'does not exist')
      || '. Running as ' || current_user;
    fix := 'Run the whole of supabase/admin.sql again and read the error at the bottom of the results';
  end if;
  return next;

  -- 2. Functions the site calls
  step := 2; check_name := 'Admin functions';
  foreach fn in array array[
    'public.my_admin_access()', 'public.admin_overview()', 'public.admin_list_users(text,integer,integer)',
    'public.admin_list_contributions(integer,integer)', 'public.admin_list_grants()',
    'public.admin_grant_tool(text,text)', 'public.admin_revoke_tool(text,uuid)',
    'toolbox_private.is_admin_owner()', 'toolbox_private.require_owner()'] loop
    if to_regprocedure(fn) is null then missing := missing || fn; end if;
  end loop;
  if cardinality(missing) = 0 then status := 'OK'; detail := 'All 9 functions exist'; fix := null;
  else status := 'FAIL'; detail := 'Missing: ' || array_to_string(missing, ', '); fix := 'Run the whole of supabase/admin.sql again'; end if;
  return next;

  -- 3. Signed-in people may call them; signed-out visitors may not
  step := 3; check_name := 'Permissions';
  if to_regprocedure('public.my_admin_access()') is null then
    status := 'FAIL'; detail := 'Cannot check: my_admin_access() is missing'; fix := 'Run supabase/admin.sql';
  elsif has_function_privilege('authenticated', 'public.my_admin_access()', 'execute')
    and has_function_privilege('authenticated', 'public.admin_overview()', 'execute')
    and not has_function_privilege('anon', 'public.admin_overview()', 'execute') then
    status := 'OK'; detail := 'Signed-in accounts can call the functions; signed-out visitors cannot'; fix := null;
  else
    status := 'FAIL'; detail := 'The grants at the end of admin.sql are not in place';
    fix := 'Run supabase/admin.sql again (the grant lines are near the end)';
  end if;
  return next;

  -- 4. Tables the admin pages read
  step := 4; check_name := 'Contributions tables (supporters.sql)';
  if to_regclass('public.toolbox_contributions') is not null and to_regclass('public.toolbox_supporters') is not null then
    status := 'OK'; detail := 'toolbox_contributions and toolbox_supporters exist'; fix := null;
  else
    status := 'FAIL'; detail := 'Missing toolbox_contributions or toolbox_supporters';
    fix := 'Run supabase/supporters.sql, then supabase/admin.sql';
  end if;
  return next;

  step := 5; check_name := 'Profile columns';
  if to_regclass('public.profiles') is null then
    status := 'FAIL'; detail := 'public.profiles does not exist'; fix := 'Run supabase/toolbox-all.sql (or schema.sql), then admin.sql';
  else
    foreach col in array array['username', 'display_name', 'avatar_url', 'profile_picture'] loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = col) then
        missing_cols := missing_cols || col;
      end if;
    end loop;
    if cardinality(missing_cols) = 0 then status := 'OK'; detail := 'username, display_name, avatar_url and profile_picture exist'; fix := null;
    else status := 'FAIL'; detail := 'profiles is missing: ' || array_to_string(missing_cols, ', '); fix := 'Run the current supabase/admin.sql (it adds them)'; end if;
  end if;
  return next;

  -- 6. Owner accounts
  step := 6; check_name := 'Owner accounts';
  if to_regclass('toolbox_private.admin_owners') is null then
    status := 'FAIL'; detail := 'No owner list'; fix := 'Run supabase/admin.sql';
    return next;
    return;
  else
    detail := '';
    for owner_row in
      select o.email, u.id, u.email_confirmed_at, u.last_sign_in_at
        from toolbox_private.admin_owners o
        left join auth.users u on lower(u.email) = o.email
       order by o.email
    loop
      if owner_row.id is null then
        detail := detail || owner_row.email || ': no Toolbox account; ';
      elsif owner_row.email_confirmed_at is null then
        found_owner := true;
        detail := detail || owner_row.email || ': account found but email NOT verified; ';
      else
        found_owner := true; verified_owner := true;
        detail := detail || owner_row.email || ': verified, last sign-in ' || coalesce(to_char(owner_row.last_sign_in_at, 'YYYY-MM-DD'), 'never') || '; ';
      end if;
    end loop;
    if verified_owner then status := 'OK'; fix := 'Sign in to Toolbox with one of the verified accounts';
    elsif found_owner then status := 'FAIL'; fix := 'Verify the account''s email (Supabase → Authentication → Users), then sign in again';
    else status := 'FAIL'; fix := 'Sign up on Toolbox with one of these emails, or add yours: insert into toolbox_private.admin_owners(email) values (''you@example.com'');'; end if;
    return next;
  end if;

  -- 7-10. Call the functions exactly as the site does, as each verified owner
  for owner_row in
    select u.id, lower(u.email) as email
      from toolbox_private.admin_owners o
      join auth.users u on lower(u.email) = o.email
     where u.email_confirmed_at is not null
     order by o.email
  loop
    perform set_config('request.jwt.claim.sub', owner_row.id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_row.id::text, 'role', 'authenticated', 'email', owner_row.email)::text, true);

    step := 7; check_name := 'my_admin_access() as ' || owner_row.email;
    begin
      res := public.my_admin_access();
      if (res->>'owner')::boolean then status := 'OK'; detail := 'Recognised as the owner: ' || res::text; fix := null;
      else status := 'FAIL'; detail := 'Not recognised as the owner: ' || res::text; fix := 'Check the email in toolbox_private.admin_owners matches this account exactly'; end if;
    exception when others then status := 'FAIL'; detail := SQLERRM; fix := 'Run supabase/admin.sql again and send this error';
    end;
    return next;

    step := 8; check_name := 'admin_overview() as ' || owner_row.email;
    begin
      res := public.admin_overview();
      status := 'OK'; detail := format('%s people, %s contributions, %s private tool shares', res->>'users', res->>'contributions', res->>'grants'); fix := null;
    exception when others then status := 'FAIL'; detail := SQLERRM; fix := 'Send this error';
    end;
    return next;

    step := 9; check_name := 'admin_list_users() as ' || owner_row.email;
    begin
      select count(*) into cnt from public.admin_list_users('', 5, 0);
      status := 'OK'; detail := cnt || ' row(s) returned'; fix := null;
    exception when others then status := 'FAIL'; detail := SQLERRM; fix := 'Send this error';
    end;
    return next;

    step := 10; check_name := 'admin_list_contributions() and admin_list_grants() as ' || owner_row.email;
    begin
      select count(*) into cnt from public.admin_list_contributions(5, 0);
      perform count(*) from public.admin_list_grants();
      status := 'OK'; detail := cnt || ' contribution row(s) returned'; fix := null;
    exception when others then status := 'FAIL'; detail := SQLERRM; fix := 'Send this error';
    end;
    return next;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- 11. Someone who is not the owner is refused
  step := 11; check_name := 'Non-owners are refused';
  select u.id into other_id from auth.users u
   where not exists (select 1 from toolbox_private.admin_owners o where o.email = lower(u.email))
   limit 1;
  if other_id is null then
    status := 'WARN'; detail := 'No other account to test with'; fix := null;
  else
    perform set_config('request.jwt.claim.sub', other_id::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id::text, 'role', 'authenticated')::text, true);
    begin
      perform public.admin_overview();
      status := 'FAIL'; detail := 'A non-owner could read the overview'; fix := 'Run supabase/admin.sql again';
    exception when others then
      status := 'OK'; detail := 'Refused: ' || SQLERRM; fix := null;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
  end if;
  return next;
end;
$$;

-- Ask the API to pick up the functions (the usual reason the site still says "not set up").
notify pgrst, 'reload schema';

-- The SQL Editor shows only the last result, so the report comes last.
select * from pg_temp.toolbox_admin_check() order by step, check_name;
