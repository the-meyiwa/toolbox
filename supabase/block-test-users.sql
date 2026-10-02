-- ============================================================
-- Toolbox: test, placeholder and throwaway accounts are not allowed.
--
-- Run once in the Supabase SQL Editor. New sign-ups (and email changes)
-- with such addresses are refused by the database itself, so the rule
-- holds even for requests that bypass the Toolbox site. The same rule
-- lives in js/lib/account-policy.js for the browser and the server.
-- ============================================================

create or replace function public.toolbox_is_test_email(addr text)
returns boolean
language plpgsql
immutable
as $$
declare
  e text := lower(trim(coalesce(addr, '')));
  local_part text;
  domain text;
  tld text;
begin
  if position('@' in e) < 2 then return true; end if;
  local_part := split_part(split_part(e, '@', 1), '+', 1);
  domain := split_part(e, '@', 2);
  if domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then return true; end if;
  tld := regexp_replace(domain, '^.*\.', '');
  if tld in ('test', 'example', 'invalid', 'localhost', 'local', 'internal', 'lan', 'home', 'corp', 'localdomain') then return true; end if;
  if domain ~ '(^|\.)(example\.(com|net|org|edu)|test\.(com|net|org)|testing\.com|testmail\.com|testuser\.com|fake\.com|fakemail\.com|fakeinbox\.com|noemail\.com|nomail\.com|none\.com|domain\.com|mailinator\.(com|net)|guerrillamail\.(com|net)|guerrillamailblock\.com|sharklasers\.com|grr\.la|10minutemail\.(com|net)|temp-mail\.org|tempmail\.(com|net)|tempmailo\.com|throwawaymail\.com|yopmail\.(com|net)|trashmail\.com|getnada\.com|dispostable\.com|maildrop\.cc|mintemail\.com|mohmal\.com|emailondeck\.com|spamgourmet\.com|mailnesia\.com|tempinbox\.com|burnermail\.io|moakt\.com)$' then
    return true;
  end if;
  return local_part ~ '^(test|tests|tester|testing|testuser|test[._-]?user|user[._-]?test|test[._-]?account|demo|demo[._-]?user|dummy|fake|sample|placeholder|foo|bar|foobar|asdf|qwerty|noreply|no-reply|null|nobody|anonymous|guest)([._+-]?[0-9]*)?$';
end;
$$;

create or replace function public.toolbox_refuse_test_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email <> '' and public.toolbox_is_test_email(new.email) then
    raise exception 'Toolbox accounts are for real people. Test and throwaway addresses are not allowed.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists toolbox_refuse_test_accounts on auth.users;
create trigger toolbox_refuse_test_accounts
  before insert or update of email on auth.users
  for each row execute function public.toolbox_refuse_test_accounts();

-- To see existing test accounts (review before deleting any):
--   select id, email, created_at from auth.users where public.toolbox_is_test_email(email);
