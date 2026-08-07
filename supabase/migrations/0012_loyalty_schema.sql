-- Phase 3 foundation: loyalty configuration, balances, purchases, ledger, and rewards.

create type public.loyalty_program_status as enum ('ACTIVE', 'PAUSED');
create type public.loyalty_rule_type as enum ('PER_PURCHASE', 'PER_AMOUNT');
create type public.purchase_status as enum ('CONFIRMED', 'CANCELLED');
create type public.stamp_ledger_entry_type as enum ('PURCHASE', 'ADJUSTMENT', 'CANCELLATION');
create type public.reward_status as enum ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'CANCELLED');

create table public.loyalty_programs (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  status public.loyalty_program_status not null default 'ACTIVE',
  rule_type public.loyalty_rule_type not null,
  minimum_purchase_minor bigint not null default 0,
  stamps_per_purchase integer not null default 1,
  amount_per_stamp_minor bigint,
  carry_remainder boolean not null default true,
  reward_stamp_goal integer not null,
  reward_name text not null,
  reward_description text not null default '',
  reward_expiration_days integer,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_programs_name_not_blank check (length(btrim(name)) > 0),
  constraint loyalty_programs_minimum_nonnegative check (minimum_purchase_minor >= 0),
  constraint loyalty_programs_stamps_positive check (stamps_per_purchase > 0),
  constraint loyalty_programs_amount_rule check (
    (rule_type = 'PER_PURCHASE' and amount_per_stamp_minor is null)
    or (rule_type = 'PER_AMOUNT' and amount_per_stamp_minor > 0)
  ),
  constraint loyalty_programs_goal_positive check (reward_stamp_goal > 0),
  constraint loyalty_programs_expiration_positive check (
    reward_expiration_days is null or reward_expiration_days > 0
  ),
  constraint loyalty_programs_version_positive check (version > 0)
);

create unique index loyalty_programs_one_active_per_tenant_idx
  on public.loyalty_programs (tenant_id) where status = 'ACTIVE';

create table public.customer_loyalty_balances (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  stamp_balance integer not null default 0,
  remainder_minor bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint customer_balances_stamps_nonnegative check (stamp_balance >= 0),
  constraint customer_balances_remainder_nonnegative check (remainder_minor >= 0)
);

create table public.purchases (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  ticket_number text not null,
  amount_minor bigint not null,
  occurred_at timestamptz not null default now(),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  rule_type public.loyalty_rule_type not null,
  program_version integer not null,
  stamps_awarded integer not null default 0,
  remainder_before_minor bigint not null default 0,
  remainder_after_minor bigint not null default 0,
  status public.purchase_status not null default 'CONFIRMED',
  cancelled_at timestamptz,
  cancelled_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  constraint purchases_ticket_not_blank check (length(btrim(ticket_number)) > 0),
  constraint purchases_amount_positive check (amount_minor > 0),
  constraint purchases_stamps_nonnegative check (stamps_awarded >= 0),
  constraint purchases_remainder_nonnegative check (remainder_before_minor >= 0 and remainder_after_minor >= 0),
  constraint purchases_cancellation_consistency check (
    (status = 'CONFIRMED' and cancelled_at is null)
    or (status = 'CANCELLED' and cancelled_at is not null)
  )
);

create unique index purchases_branch_ticket_unique_idx
  on public.purchases (branch_id, ticket_number);

create table public.stamp_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  entry_type public.stamp_ledger_entry_type not null,
  purchase_id uuid references public.purchases(id) on delete restrict,
  stamps_delta integer not null,
  balance_after integer not null,
  remainder_after_minor bigint not null default 0,
  reason text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stamp_ledger_balance_nonnegative check (balance_after >= 0),
  constraint stamp_ledger_remainder_nonnegative check (remainder_after_minor >= 0)
);

create table public.rewards (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  program_id uuid not null references public.loyalty_programs(id) on delete restrict,
  source_purchase_id uuid references public.purchases(id) on delete restrict,
  name text not null,
  description text not null default '',
  status public.reward_status not null default 'AVAILABLE',
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rewards_name_not_blank check (length(btrim(name)) > 0),
  constraint rewards_redeemed_consistency check (
    (status = 'REDEEMED' and redeemed_at is not null)
    or (status <> 'REDEEMED' and redeemed_at is null)
  )
);

create index purchases_customer_created_idx on public.purchases (customer_id, created_at desc);
create index stamp_ledger_customer_created_idx on public.stamp_ledger (customer_id, created_at desc);
create index rewards_customer_status_idx on public.rewards (customer_id, status);

create or replace function app.enforce_loyalty_tenant_consistency()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare record_tenant_id uuid;
begin
  if tg_table_name = 'customer_loyalty_balances' then
    select tenant_id into record_tenant_id from public.customers where id = new.customer_id;
  elsif tg_table_name = 'purchases' then
    select tenant_id into record_tenant_id from public.customers where id = new.customer_id;
  elsif tg_table_name = 'stamp_ledger' then
    select tenant_id into record_tenant_id from public.customers where id = new.customer_id;
  elsif tg_table_name = 'rewards' then
    select tenant_id into record_tenant_id from public.customers where id = new.customer_id;
  end if;
  if record_tenant_id is distinct from new.tenant_id then
    raise exception 'loyalty record tenant must match customer' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger customer_balances_enforce_tenant before insert or update on public.customer_loyalty_balances
  for each row execute function app.enforce_loyalty_tenant_consistency();
create trigger purchases_enforce_tenant before insert or update on public.purchases
  for each row execute function app.enforce_loyalty_tenant_consistency();
create trigger stamp_ledger_enforce_tenant before insert or update on public.stamp_ledger
  for each row execute function app.enforce_loyalty_tenant_consistency();
create trigger rewards_enforce_tenant before insert or update on public.rewards
  for each row execute function app.enforce_loyalty_tenant_consistency();

alter table public.loyalty_programs enable row level security;
alter table public.customer_loyalty_balances enable row level security;
alter table public.purchases enable row level security;
alter table public.stamp_ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.loyalty_programs force row level security;
alter table public.customer_loyalty_balances force row level security;
alter table public.purchases force row level security;
alter table public.stamp_ledger force row level security;
alter table public.rewards force row level security;

create policy loyalty_programs_staff_access on public.loyalty_programs for select to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id) or app.is_superadmin());
create policy customer_balances_staff_access on public.customer_loyalty_balances for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and app.current_staff_can_access_branch(c.source_branch_id)));
create policy purchases_staff_access on public.purchases for select to authenticated
  using (app.current_staff_can_access_branch(branch_id));
create policy ledger_staff_access on public.stamp_ledger for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and app.current_staff_can_access_branch(c.source_branch_id)));
create policy rewards_staff_access on public.rewards for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and app.current_staff_can_access_branch(c.source_branch_id)));

revoke all on public.loyalty_programs, public.customer_loyalty_balances, public.purchases, public.stamp_ledger, public.rewards from anon;
grant select on public.loyalty_programs, public.customer_loyalty_balances, public.purchases, public.stamp_ledger, public.rewards to authenticated;
