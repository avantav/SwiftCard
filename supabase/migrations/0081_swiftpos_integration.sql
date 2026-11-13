-- DEC-0071: SwiftPOS sales accrue loyalty in SwiftCard.
--
-- SwiftPOS authenticates with a per-tenant API key (only its SHA-256 is
-- stored), identifies the customer by scanning the card QR and sends
-- purchases. Integration purchases have source SWIFTPOS and no staff profile.
-- app.confirm_card_purchase and the employee PWA are NOT modified: the
-- integration has its own function whose calculation block is copied from
-- 0049 and covered by a parity test. Everything is gated by the
-- swiftpos_integration module (DEC-0072).

create table public.tenant_integrations (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  provider text not null default 'SWIFTPOS',
  status text not null default 'ACTIVE',
  max_amount_minor bigint not null default 2000000,
  max_purchases_per_card_hour integer not null default 5,
  max_purchases_per_card_day integer not null default 20,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_integrations_provider check (provider = 'SWIFTPOS'),
  constraint tenant_integrations_status check (status in ('ACTIVE', 'REVOKED')),
  constraint tenant_integrations_max_amount check (max_amount_minor > 0),
  constraint tenant_integrations_hour_limit check (max_purchases_per_card_hour between 1 and 100),
  constraint tenant_integrations_day_limit check (max_purchases_per_card_day between 1 and 500),
  constraint tenant_integrations_limits_order check (max_purchases_per_card_hour <= max_purchases_per_card_day)
);
create unique index tenant_integrations_one_per_tenant
  on public.tenant_integrations (tenant_id, provider);

create table public.integration_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  integration_id uuid not null references public.tenant_integrations(id) on delete restrict,
  key_prefix text not null unique,
  key_hash text not null unique,
  status text not null default 'ACTIVE',
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint integration_keys_prefix_format check (key_prefix ~ '^[a-z0-9]{8}$'),
  constraint integration_keys_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint integration_keys_status check (status in ('ACTIVE', 'REVOKED')),
  constraint integration_keys_revocation check ((status = 'REVOKED') = (revoked_at is not null))
);
create index integration_keys_integration_idx on public.integration_keys (integration_id);

create table public.integration_branch_links (
  integration_id uuid not null references public.tenant_integrations(id) on delete restrict,
  external_store_id text not null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (integration_id, external_store_id),
  constraint integration_branch_links_store_format check (external_store_id ~ '^[A-Za-z0-9_.:-]{1,100}$')
);

create table public.integration_request_windows (
  key_id uuid not null references public.integration_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (key_id, window_start)
);

alter table public.tenant_integrations enable row level security;
alter table public.tenant_integrations force row level security;
alter table public.integration_keys enable row level security;
alter table public.integration_keys force row level security;
alter table public.integration_branch_links enable row level security;
alter table public.integration_branch_links force row level security;
alter table public.integration_request_windows enable row level security;
alter table public.integration_request_windows force row level security;

create policy tenant_integrations_superadmin_read on public.tenant_integrations
  for select to authenticated using (app.is_superadmin());
create policy integration_keys_superadmin_read on public.integration_keys
  for select to authenticated using (app.is_superadmin());
create policy integration_branch_links_superadmin_read on public.integration_branch_links
  for select to authenticated using (app.is_superadmin());

revoke all on public.tenant_integrations, public.integration_keys,
  public.integration_branch_links, public.integration_request_windows
  from public, anon, authenticated;
grant select on public.tenant_integrations, public.integration_branch_links to authenticated;
grant select (id, integration_id, key_prefix, status, created_at, expires_at, revoked_at, last_used_at)
  on public.integration_keys to authenticated;

create function app.enforce_integration_branch_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not exists (
    select 1 from public.tenant_integrations i
    join public.branches b on b.tenant_id = i.tenant_id
    where i.id = new.integration_id and b.id = new.branch_id
  ) then
    raise exception 'integration branch must belong to the integration tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger integration_branch_links_enforce_tenant
  before insert or update on public.integration_branch_links
  for each row execute function app.enforce_integration_branch_tenant();

-- Purchases: origin of the purchase. Existing rows are STAFF purchases.
create type public.purchase_source as enum ('STAFF', 'SWIFTPOS');

alter table public.purchases
  add column source public.purchase_source not null default 'STAFF',
  add column integration_id uuid references public.tenant_integrations(id) on delete restrict,
  add column external_sale_id text,
  add column external_operator_id text,
  add column external_operator_name text,
  alter column staff_profile_id drop not null,
  add constraint purchases_source_actor check (
    (source = 'STAFF' and staff_profile_id is not null and integration_id is null
      and external_sale_id is null and external_operator_id is null and external_operator_name is null)
    or (source = 'SWIFTPOS' and staff_profile_id is null and integration_id is not null
      and external_sale_id is not null and external_operator_id is not null and external_operator_name is not null)
  );
create unique index purchases_integration_sale_unique
  on public.purchases (integration_id, external_sale_id)
  where integration_id is not null;
create index purchases_integration_customer_created_idx
  on public.purchases (customer_id, created_at desc)
  where source = 'SWIFTPOS';

-- The location of an integration purchase is validated by
-- app.integration_confirm_purchase when SwiftPOS sends one and the
-- location_validation switch is active; the branch comes from the key's
-- store mapping, not from a device. STAFF purchases keep the same rule.
create or replace function app.enforce_purchase_location()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
begin
  if new.source = 'SWIFTPOS' then
    return new;
  end if;
  if not app.validate_operation_location(new.tenant_id, new.branch_id, new.latitude, new.longitude) then
    raise exception 'operation location is outside the branch geofence' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Authenticates a key hash and applies the per-key request limit
-- (120 requests per minute). Internal: only called by the functions below.
create function app.integration_authenticate(target_key_hash text)
returns table (
  result text,
  integration_id uuid,
  tenant_id uuid,
  key_id uuid,
  max_amount_minor bigint,
  max_purchases_per_card_hour integer,
  max_purchases_per_card_day integer
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
#variable_conflict use_column
declare
  key_record record;
  current_window timestamptz := date_trunc('minute', now());
  used integer;
begin
  if target_key_hash is null or target_key_hash !~ '^[0-9a-f]{64}$' then
    return query select 'UNAUTHORIZED', null::uuid, null::uuid, null::uuid, null::bigint, null::integer, null::integer;
    return;
  end if;

  select k.id as key_id, k.last_used_at, i.id as integration_id, i.tenant_id,
    i.max_amount_minor, i.max_purchases_per_card_hour, i.max_purchases_per_card_day
  into key_record
  from public.integration_keys k
  join public.tenant_integrations i on i.id = k.integration_id
  join public.tenants t on t.id = i.tenant_id
  where k.key_hash = target_key_hash
    and k.status = 'ACTIVE'
    and (k.expires_at is null or k.expires_at > now())
    and i.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if key_record.key_id is null then
    return query select 'UNAUTHORIZED', null::uuid, null::uuid, null::uuid, null::bigint, null::integer, null::integer;
    return;
  end if;

  insert into public.integration_request_windows as w (key_id, window_start, request_count)
  values (key_record.key_id, current_window, 1)
  on conflict (key_id, window_start) do update set request_count = w.request_count + 1
  returning w.request_count into used;
  delete from public.integration_request_windows w
  where w.key_id = key_record.key_id and w.window_start < current_window - interval '10 minutes';

  if used > 120 then
    return query select 'RATE_LIMITED', null::uuid, null::uuid, null::uuid, null::bigint, null::integer, null::integer;
    return;
  end if;

  if key_record.last_used_at is null or key_record.last_used_at < now() - interval '1 minute' then
    update public.integration_keys set last_used_at = now() where id = key_record.key_id;
  end if;

  return query select 'OK', key_record.integration_id, key_record.tenant_id, key_record.key_id,
    key_record.max_amount_minor, key_record.max_purchases_per_card_hour, key_record.max_purchases_per_card_day;
end;
$$;

-- Effective module state for SwiftPOS (works even when the module is off).
create function app.integration_status(target_key_hash text)
returns table (result text, modules jsonb)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  auth_record record;
begin
  select * into auth_record from app.integration_authenticate(target_key_hash);
  if auth_record.result <> 'OK' then
    return query select auth_record.result, null::jsonb;
    return;
  end if;
  return query select 'OK', jsonb_build_object(
    'swiftpos_integration', app.tenant_has_module('swiftpos_integration', auth_record.tenant_id),
    'swiftpos_integration.card_resolve', app.tenant_has_module('swiftpos_integration.card_resolve', auth_record.tenant_id),
    'swiftpos_integration.purchases', app.tenant_has_module('swiftpos_integration.purchases', auth_record.tenant_id),
    'swiftpos_integration.wallet_refresh', app.tenant_has_module('swiftpos_integration.wallet_refresh', auth_record.tenant_id),
    'swiftpos_integration.location_validation', app.tenant_has_module('swiftpos_integration.location_validation', auth_record.tenant_id)
  );
end;
$$;

-- Identifies the customer from a scanned card. Never returns phone, email,
-- tokens or the customer id.
create function app.integration_resolve_card(
  target_key_hash text,
  target_external_store_id text,
  target_card_token text
)
returns table (
  result text,
  integration_id uuid,
  branch_id uuid,
  customer_card_id uuid,
  first_name text,
  card_name text,
  program_type text,
  balance integer,
  unit_name_singular text,
  unit_name_plural text,
  available_rewards integer
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
#variable_conflict use_column
declare
  auth_record record;
  link_branch_id uuid;
  card_record record;
begin
  select * into auth_record from app.integration_authenticate(target_key_hash);
  if auth_record.result <> 'OK' then
    return query select auth_record.result, null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::integer, null::text, null::text, null::integer;
    return;
  end if;
  if not app.tenant_has_module('swiftpos_integration.card_resolve', auth_record.tenant_id) then
    return query select 'MODULE_NOT_ACTIVE', null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  select l.branch_id into link_branch_id
  from public.integration_branch_links l
  join public.branches b on b.id = l.branch_id and b.status = 'ACTIVE'
  where l.integration_id = auth_record.integration_id
    and l.external_store_id = target_external_store_id;
  if link_branch_id is null then
    return query select 'BRANCH_NOT_LINKED', null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  select issued.id as customer_card_id, customer.id as customer_id,
    split_part(btrim(customer.full_name), ' ', 1) as first_name,
    card.id as loyalty_card_id, card.name as card_name,
    program.program_type::text as program_type, program.status::text as program_status,
    case when program.program_type = 'LIFETIME_POINTS'
      then floor(coalesce(balance.lifetime_points_tenths, 0)::numeric / 10)::integer
      else coalesce(balance.stamp_balance, 0) end as balance,
    program.unit_name_singular, program.unit_name_plural
  into card_record
  from public.customer_cards issued
  join public.customers customer on customer.id = issued.customer_id and customer.status = 'ACTIVE'
  join public.loyalty_cards card on card.id = issued.loyalty_card_id and card.status = 'PUBLISHED'
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = link_branch_id
  left join public.customer_loyalty_balances balance on balance.customer_id = customer.id
  where issued.public_token = target_card_token
    and issued.status = 'ACTIVE'
    and issued.tenant_id = auth_record.tenant_id;

  if card_record.customer_card_id is null then
    return query select 'CARD_NOT_FOUND', null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::integer, null::text, null::text, null::integer;
    return;
  end if;
  if card_record.program_status <> 'ACTIVE' then
    return query select 'PROGRAM_PAUSED', null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::integer, null::text, null::text, null::integer;
    return;
  end if;

  return query select 'FOUND', auth_record.integration_id, link_branch_id, card_record.customer_card_id,
    card_record.first_name, card_record.card_name, card_record.program_type, card_record.balance,
    card_record.unit_name_singular, card_record.unit_name_plural,
    (select count(*)::integer from public.rewards reward
      where reward.customer_id = card_record.customer_id
        and reward.loyalty_card_id = card_record.loyalty_card_id
        and reward.status = 'AVAILABLE'
        and (reward.expires_at is null or reward.expires_at > now()));
end;
$$;

-- Records a purchase sent by SwiftPOS. The calculation block (from the
-- balance lock to the ledger insert) is copied from app.confirm_card_purchase
-- in 0049; keep both in sync (supabase/tests/0081 checks parity).
create function app.integration_confirm_purchase(
  target_key_hash text,
  target_external_store_id text,
  target_customer_card_id uuid,
  target_expected_integration_id uuid,
  target_expected_branch_id uuid,
  target_external_sale_id text,
  target_ticket_number text,
  target_amount_minor bigint,
  target_occurred_at timestamptz,
  target_operator_id text,
  target_operator_name text,
  target_latitude numeric,
  target_longitude numeric
)
returns table (
  result text, purchase_id uuid, stamps_awarded integer,
  rewards_generated integer, balance integer, customer_id uuid
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
#variable_conflict use_column
declare
  auth_record record;
  target_branch_id uuid;
  existing_record record;
  issued_record record;
  program_record record;
  balance_record record;
  calculated_stamps integer;
  calculated_tenths bigint;
  calculated_remainder bigint;
  purchase_id_value uuid;
  tier_result record;
  final_balance_integer integer;
  final_balance_tenths_value bigint;
  generated_rewards integer := 0;
  completed_cycles_value integer := 0;
  stored_latitude numeric := target_latitude;
  stored_longitude numeric := target_longitude;
begin
  select * into auth_record from app.integration_authenticate(target_key_hash);
  if auth_record.result <> 'OK' then
    return query select auth_record.result, null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;
  if not app.tenant_has_module('swiftpos_integration.purchases', auth_record.tenant_id) then
    return query select 'MODULE_NOT_ACTIVE', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  select l.branch_id into target_branch_id
  from public.integration_branch_links l
  join public.branches b on b.id = l.branch_id and b.status = 'ACTIVE'
  where l.integration_id = auth_record.integration_id
    and l.external_store_id = target_external_store_id;
  if target_branch_id is null then
    return query select 'BRANCH_NOT_LINKED', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;
  -- The signed scan ticket binds the card to this integration and branch.
  if target_expected_integration_id is distinct from auth_record.integration_id
    or target_expected_branch_id is distinct from target_branch_id then
    return query select 'SCAN_TICKET_MISMATCH', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  if target_external_sale_id is null or target_external_sale_id !~ '^[A-Za-z0-9_.:-]{1,100}$'
    or nullif(btrim(target_ticket_number), '') is null or length(btrim(target_ticket_number)) > 60
    or nullif(btrim(target_operator_id), '') is null or length(btrim(target_operator_id)) > 100
    or nullif(btrim(target_operator_name), '') is null or length(btrim(target_operator_name)) > 120
    or target_amount_minor is null or target_amount_minor <= 0
    or target_occurred_at is null
    or (target_latitude is null) <> (target_longitude is null) then
    return query select 'INVALID', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  -- Idempotency: a retried sale returns its original result.
  select p.id, p.customer_id, p.amount_minor, p.stamps_awarded, p.status,
    issued.id as customer_card_id
  into existing_record
  from public.purchases p
  left join public.customer_cards issued
    on issued.customer_id = p.customer_id and issued.loyalty_card_id = p.loyalty_card_id
  where p.integration_id = auth_record.integration_id
    and p.external_sale_id = target_external_sale_id;
  if existing_record.id is not null then
    if existing_record.customer_card_id is distinct from target_customer_card_id
      or existing_record.amount_minor <> target_amount_minor then
      return query select 'IDEMPOTENCY_CONFLICT', null::uuid, 0, 0, null::integer, null::uuid;
      return;
    end if;
    return query select 'ALREADY_RECORDED', existing_record.id, existing_record.stamps_awarded, 0,
      (select case when program.program_type = 'LIFETIME_POINTS'
          then floor(coalesce(b.lifetime_points_tenths, 0)::numeric / 10)::integer
          else coalesce(b.stamp_balance, 0) end
       from public.customer_cards issued
       join public.loyalty_cards card on card.id = issued.loyalty_card_id
       join public.loyalty_programs program on program.id = card.program_id
       left join public.customer_loyalty_balances b on b.customer_id = issued.customer_id
       where issued.id = target_customer_card_id),
      existing_record.customer_id;
    return;
  end if;

  if target_amount_minor > auth_record.max_amount_minor
    or target_occurred_at > now() + interval '5 minutes'
    or target_occurred_at < now() - interval '72 hours' then
    return query select 'LIMIT_EXCEEDED', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  select issued.customer_id, issued.tenant_id, issued.status, issued.loyalty_card_id
    into issued_record
  from public.customer_cards issued join public.customers customer on customer.id = issued.customer_id
  where issued.id = target_customer_card_id and customer.status = 'ACTIVE';
  select program.* into program_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
  where card.id = issued_record.loyalty_card_id and card.status = 'PUBLISHED';
  if issued_record.status is distinct from 'ACTIVE'
    or issued_record.tenant_id is distinct from auth_record.tenant_id
    or program_record.id is null then
    return query select 'CARD_NOT_FOUND', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;
  if program_record.status <> 'ACTIVE' then
    return query select 'PROGRAM_PAUSED', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  if (select count(*) from public.purchases p
      where p.customer_id = issued_record.customer_id and p.source = 'SWIFTPOS'
        and p.created_at > now() - interval '1 hour') >= auth_record.max_purchases_per_card_hour
    or (select count(*) from public.purchases p
      where p.customer_id = issued_record.customer_id and p.source = 'SWIFTPOS'
        and p.created_at > now() - interval '1 day') >= auth_record.max_purchases_per_card_day then
    return query select 'LIMIT_EXCEEDED', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  if target_latitude is not null then
    if app.tenant_has_module('swiftpos_integration.location_validation', auth_record.tenant_id) then
      if not app.validate_operation_location(auth_record.tenant_id, target_branch_id, target_latitude, target_longitude) then
        return query select 'OUTSIDE_GEOFENCE', null::uuid, 0, 0, null::integer, null::uuid;
        return;
      end if;
    else
      stored_latitude := null;
      stored_longitude := null;
    end if;
  end if;

  if exists (select 1 from public.purchases purchase
    where purchase.branch_id = target_branch_id
      and purchase.ticket_number = btrim(target_ticket_number)) then
    return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, null::integer, null::uuid;
    return;
  end if;

  -- BEGIN calculation block copied from 0049 app.confirm_card_purchase.
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:customer-balance:' || issued_record.customer_id::text, 0)
  );
  select balance.* into balance_record
  from public.customer_loyalty_balances balance
  where balance.customer_id = issued_record.customer_id for update;
  if balance_record.id is null then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (auth_record.tenant_id, issued_record.customer_id);
    select balance.* into balance_record
    from public.customer_loyalty_balances balance
    where balance.customer_id = issued_record.customer_id for update;
  end if;

  if program_record.program_type = 'LIFETIME_POINTS' then
    calculated_tenths := floor(
      target_amount_minor::numeric * 10 / program_record.amount_per_stamp_minor
    )::bigint;
    if balance_record.lifetime_points_tenths + calculated_tenths > 21474836470 then
      return query select 'UNAVAILABLE', null::uuid, 0, 0, null::integer, null::uuid;
      return;
    end if;
    calculated_stamps := floor(calculated_tenths::numeric / 10)::integer;
    calculated_remainder := 0;
  elsif program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor
      then program_record.stamps_per_purchase else 0 end;
    calculated_tenths := calculated_stamps::bigint * 10;
    calculated_remainder := balance_record.remainder_minor;
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder
      then balance_record.remainder_minor else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_tenths := calculated_stamps::bigint * 10;
    calculated_remainder := case when program_record.carry_remainder
      then (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;

  insert into public.purchases (
    tenant_id, customer_id, branch_id, staff_profile_id, ticket_number,
    amount_minor, occurred_at, latitude, longitude, rule_type, program_version,
    stamps_awarded, units_awarded_tenths,
    remainder_before_minor, remainder_after_minor, reward_cycle_goal,
    loyalty_card_id, program_id,
    source, integration_id, external_sale_id, external_operator_id, external_operator_name
  ) values (
    auth_record.tenant_id, issued_record.customer_id, target_branch_id,
    null, btrim(target_ticket_number), target_amount_minor, target_occurred_at,
    stored_latitude, stored_longitude, program_record.rule_type,
    program_record.version, calculated_stamps, calculated_tenths,
    balance_record.remainder_minor, calculated_remainder,
    case when program_record.program_type = 'LIFETIME_POINTS'
      then null else program_record.reward_stamp_goal end,
    issued_record.loyalty_card_id, program_record.id,
    'SWIFTPOS', auth_record.integration_id, target_external_sale_id,
    btrim(target_operator_id), btrim(target_operator_name)
  ) returning id into purchase_id_value;

  if program_record.program_type = 'LIFETIME_POINTS' then
    select * into tier_result from app.apply_lifetime_point_milestones(
      issued_record.customer_id, program_record.id, issued_record.loyalty_card_id,
      balance_record.lifetime_points_tenths, calculated_tenths, purchase_id_value
    );
    final_balance_tenths_value := tier_result.final_balance_tenths;
    final_balance_integer := floor(final_balance_tenths_value::numeric / 10)::integer;
    generated_rewards := tier_result.rewards_generated;
  else
    select * into tier_result from app.apply_reward_tiers(
      issued_record.customer_id, program_record.id, balance_record.stamp_balance,
      calculated_stamps, purchase_id_value, null
    );
    final_balance_integer := tier_result.final_balance;
    final_balance_tenths_value := tier_result.final_balance::bigint * 10;
    generated_rewards := tier_result.rewards_generated;
    completed_cycles_value := tier_result.cycles_completed;
    update public.customer_loyalty_balances
    set remainder_minor = calculated_remainder, updated_at = now()
    where customer_id = issued_record.customer_id;
    update public.purchases
    set reward_cycles_completed = completed_cycles_value
    where id = purchase_id_value;
  end if;

  insert into public.stamp_ledger (
    tenant_id, customer_id, entry_type, purchase_id, stamps_delta,
    balance_after, remainder_after_minor, created_by_staff_id, loyalty_card_id,
    units_delta_tenths, balance_after_tenths
  ) values (
    auth_record.tenant_id, issued_record.customer_id, 'PURCHASE', purchase_id_value,
    calculated_stamps, final_balance_integer,
    calculated_remainder, null, issued_record.loyalty_card_id,
    calculated_tenths, final_balance_tenths_value
  );
  -- END calculation block.

  return query select 'CONFIRMED', purchase_id_value, calculated_stamps,
    generated_rewards, final_balance_integer, issued_record.customer_id;
exception when unique_violation then
  return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, null::integer, null::uuid;
end;
$$;

-- Superadmin administration --------------------------------------------------

create function app.ensure_tenant_integration(target_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  integration_id_value uuid;
begin
  insert into public.tenant_integrations (tenant_id, provider, created_by_staff_id)
  values (target_tenant_id, 'SWIFTPOS', auth.uid())
  on conflict (tenant_id, provider) do nothing;
  select i.id into integration_id_value from public.tenant_integrations i
  where i.tenant_id = target_tenant_id and i.provider = 'SWIFTPOS';
  return integration_id_value;
end;
$$;

-- The server generates the key; the database only receives its prefix and
-- SHA-256. At most two active keys per integration (rotation with overlap).
create function app.issue_integration_key(
  target_tenant_id uuid,
  target_key_prefix text,
  target_key_hash text,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  integration_id_value uuid;
  key_id_value uuid;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if clean_reason is null or target_key_prefix !~ '^[a-z0-9]{8}$' or target_key_hash !~ '^[0-9a-f]{64}$' then
    return 'INVALID';
  end if;
  if not exists (select 1 from public.tenants t where t.id = target_tenant_id) then
    return 'NOT_FOUND';
  end if;
  integration_id_value := app.ensure_tenant_integration(target_tenant_id);
  perform 1 from public.tenant_integrations i where i.id = integration_id_value for update;
  if (select count(*) from public.integration_keys k
      where k.integration_id = integration_id_value and k.status = 'ACTIVE') >= 2 then
    return 'TOO_MANY_KEYS';
  end if;
  insert into public.integration_keys (integration_id, key_prefix, key_hash, created_by_staff_id)
  values (integration_id_value, target_key_prefix, target_key_hash, auth.uid())
  returning id into key_id_value;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), 'INTEGRATION_KEY_ISSUED', 'integration_keys', key_id_value,
          jsonb_build_object('provider', 'SWIFTPOS', 'key_prefix', target_key_prefix, 'reason', clean_reason));
  return 'ISSUED';
exception when unique_violation then
  return 'INVALID';
end;
$$;

create function app.revoke_integration_key(target_key_id uuid, target_reason text)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  tenant_id_value uuid;
  prefix_value text;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if clean_reason is null then
    return 'INVALID';
  end if;
  update public.integration_keys k
  set status = 'REVOKED', revoked_at = now()
  from public.tenant_integrations i
  where k.id = target_key_id and i.id = k.integration_id and k.status = 'ACTIVE'
  returning i.tenant_id, k.key_prefix into tenant_id_value, prefix_value;
  if tenant_id_value is null then
    return 'NOT_FOUND';
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (tenant_id_value, auth.uid(), 'INTEGRATION_KEY_REVOKED', 'integration_keys', target_key_id,
          jsonb_build_object('provider', 'SWIFTPOS', 'key_prefix', prefix_value, 'reason', clean_reason));
  return 'REVOKED';
end;
$$;

-- target_branch_id null removes the mapping.
create function app.set_integration_branch_link(
  target_tenant_id uuid,
  target_external_store_id text,
  target_branch_id uuid,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  integration_id_value uuid;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if clean_reason is null or target_external_store_id is null
    or target_external_store_id !~ '^[A-Za-z0-9_.:-]{1,100}$' then
    return 'INVALID';
  end if;
  if not exists (select 1 from public.tenants t where t.id = target_tenant_id) then
    return 'NOT_FOUND';
  end if;
  if target_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = target_branch_id and b.tenant_id = target_tenant_id
  ) then
    return 'INVALID';
  end if;
  integration_id_value := app.ensure_tenant_integration(target_tenant_id);
  if target_branch_id is null then
    delete from public.integration_branch_links l
    where l.integration_id = integration_id_value and l.external_store_id = target_external_store_id;
  else
    insert into public.integration_branch_links (integration_id, external_store_id, branch_id)
    values (integration_id_value, target_external_store_id, target_branch_id)
    on conflict (integration_id, external_store_id) do update set branch_id = excluded.branch_id;
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), 'INTEGRATION_BRANCH_LINK_UPDATED', 'tenant_integrations', integration_id_value,
          jsonb_build_object('provider', 'SWIFTPOS', 'external_store_id', target_external_store_id,
                             'branch_id', target_branch_id, 'reason', clean_reason));
  return 'UPDATED';
end;
$$;

create function app.set_integration_limits(
  target_tenant_id uuid,
  target_max_amount_minor bigint,
  target_max_per_hour integer,
  target_max_per_day integer,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  integration_id_value uuid;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if clean_reason is null or target_max_amount_minor is null or target_max_amount_minor <= 0
    or target_max_per_hour is null or target_max_per_hour not between 1 and 100
    or target_max_per_day is null or target_max_per_day not between 1 and 500
    or target_max_per_hour > target_max_per_day then
    return 'INVALID';
  end if;
  if not exists (select 1 from public.tenants t where t.id = target_tenant_id) then
    return 'NOT_FOUND';
  end if;
  integration_id_value := app.ensure_tenant_integration(target_tenant_id);
  update public.tenant_integrations
  set max_amount_minor = target_max_amount_minor,
      max_purchases_per_card_hour = target_max_per_hour,
      max_purchases_per_card_day = target_max_per_day,
      updated_at = now()
  where id = integration_id_value;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), 'INTEGRATION_LIMITS_UPDATED', 'tenant_integrations', integration_id_value,
          jsonb_build_object('provider', 'SWIFTPOS', 'max_amount_minor', target_max_amount_minor,
                             'max_per_hour', target_max_per_hour, 'max_per_day', target_max_per_day,
                             'reason', clean_reason));
  return 'UPDATED';
end;
$$;

revoke all on function app.enforce_integration_branch_tenant() from public, anon, authenticated;
revoke all on function app.integration_authenticate(text) from public, anon, authenticated, service_role;
revoke all on function app.integration_status(text) from public, anon, authenticated;
revoke all on function app.integration_resolve_card(text, text, text) from public, anon, authenticated;
revoke all on function app.integration_confirm_purchase(text, text, uuid, uuid, uuid, text, text, bigint, timestamptz, text, text, numeric, numeric) from public, anon, authenticated;
revoke all on function app.ensure_tenant_integration(uuid) from public, anon, authenticated;
revoke all on function app.issue_integration_key(uuid, text, text, text) from public, anon;
revoke all on function app.revoke_integration_key(uuid, text) from public, anon;
revoke all on function app.set_integration_branch_link(uuid, text, uuid, text) from public, anon;
revoke all on function app.set_integration_limits(uuid, bigint, integer, integer, text) from public, anon;

grant execute on function app.integration_status(text) to service_role;
grant execute on function app.integration_resolve_card(text, text, text) to service_role;
grant execute on function app.integration_confirm_purchase(text, text, uuid, uuid, uuid, text, text, bigint, timestamptz, text, text, numeric, numeric) to service_role;
grant execute on function app.issue_integration_key(uuid, text, text, text) to authenticated;
grant execute on function app.revoke_integration_key(uuid, text) to authenticated;
grant execute on function app.set_integration_branch_link(uuid, text, uuid, text) to authenticated;
grant execute on function app.set_integration_limits(uuid, bigint, integer, integer, text) to authenticated;
