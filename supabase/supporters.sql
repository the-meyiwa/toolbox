-- Run once in the Supabase SQL editor. Only the trusted server writes these tables.
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
create index if not exists toolbox_contribution_user on public.toolbox_contributions(user_id);
create table if not exists public.toolbox_supporters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_style text not null default 'classic' check (profile_style in ('classic','etched','halo','orbit')),
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
revoke all on public.toolbox_contributions, public.toolbox_supporters, public.toolbox_supporter_previews from anon, authenticated;
grant all on public.toolbox_contributions, public.toolbox_supporters, public.toolbox_supporter_previews to service_role;

create or replace function public.confirm_toolbox_contribution(p_reference text, p_transaction_id text, p_paid_amount numeric)
returns void language plpgsql security invoker set search_path = public as $$
declare contribution toolbox_contributions%rowtype;
begin
  select * into contribution from toolbox_contributions where tx_ref = p_reference for update;
  if not found then raise exception 'Unknown contribution'; end if;
  if contribution.verified_at is not null then
    if contribution.transaction_id <> p_transaction_id then raise exception 'Transaction mismatch'; end if;
    return;
  end if;
  if p_paid_amount < contribution.amount or p_transaction_id is null then raise exception 'Invalid payment'; end if;
  update toolbox_contributions set transaction_id=p_transaction_id, paid_amount=p_paid_amount, verified_at=now() where tx_ref=p_reference;
  if contribution.user_id is not null and p_paid_amount >= contribution.supporter_threshold then
    insert into toolbox_supporters(user_id) values(contribution.user_id) on conflict(user_id) do nothing;
  end if;
end;
$$;
revoke all on function public.confirm_toolbox_contribution(text,text,numeric) from public, anon, authenticated;
grant execute on function public.confirm_toolbox_contribution(text,text,numeric) to service_role;

-- Apply this migration if the table already exists.
alter table public.toolbox_contributions alter column user_id drop not null;

create or replace function public.claim_toolbox_contribution(p_reference text, p_user_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare contribution toolbox_contributions%rowtype;
begin
  select * into contribution from toolbox_contributions where tx_ref=p_reference for update;
  if not found or contribution.verified_at is null then raise exception 'Verified contribution not found'; end if;
  if contribution.user_id is not null and contribution.user_id <> p_user_id then raise exception 'Contribution already claimed'; end if;
  update toolbox_contributions set user_id=p_user_id where tx_ref=p_reference;
  if contribution.paid_amount >= contribution.supporter_threshold then
    insert into toolbox_supporters(user_id) values(p_user_id) on conflict(user_id) do nothing;
  end if;
end;
$$;
revoke all on function public.claim_toolbox_contribution(text,uuid) from public, anon, authenticated;
grant execute on function public.claim_toolbox_contribution(text,uuid) to service_role;
