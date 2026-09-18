-- Post-MVP commercial foundation: packages, subscriptions, authoritative
-- membership usage, promotions, Stripe linkage and affiliate accounting.
-- No payment operation is performed here and membership limits are not yet
-- enforced. Historical commercial records are archived, never hard-deleted.

create type public.billing_catalog_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type public.billing_interval as enum ('MONTH', 'YEAR');
create type public.tenant_subscription_status as enum (
  'TRIALING', 'INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED'
);
create type public.billing_discount_type as enum ('PERCENT', 'FIXED_AMOUNT');
create type public.billing_promotion_duration as enum ('ONCE', 'REPEATING', 'FOREVER');
create type public.affiliate_commission_type as enum ('PERCENT', 'FIXED_AMOUNT');
create type public.affiliate_commission_status as enum ('PENDING', 'APPROVED', 'PAID', 'VOID');
create type public.stripe_event_processing_status as enum ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

create table public.billing_packages (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  name text not null,
  description text not null default '',
  status public.billing_catalog_status not null default 'DRAFT',
  membership_limit integer,
  branch_limit integer,
  loyalty_card_limit integer,
  entitlements jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_packages_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
  constraint billing_packages_name_length check (length(btrim(name)) between 2 and 100),
  constraint billing_packages_description_length check (length(description) <= 500),
  constraint billing_packages_membership_limit_positive check (membership_limit is null or membership_limit > 0),
  constraint billing_packages_branch_limit_positive check (branch_limit is null or branch_limit > 0),
  constraint billing_packages_card_limit_supported check (loyalty_card_limit is null or loyalty_card_limit between 1 and 3),
  constraint billing_packages_entitlements_object check (jsonb_typeof(entitlements) = 'object'),
  constraint billing_packages_version_positive check (version > 0)
);

create unique index billing_packages_code_unique_idx on public.billing_packages (lower(code));

create table public.billing_package_prices (
  id uuid primary key default extensions.gen_random_uuid(),
  package_id uuid not null references public.billing_packages(id) on delete restrict,
  currency_code char(3) not null,
  billing_interval public.billing_interval not null,
  amount_minor bigint not null,
  status public.billing_catalog_status not null default 'DRAFT',
  stripe_product_id text,
  stripe_price_id text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_package_prices_currency_uppercase check (currency_code = upper(currency_code)),
  constraint billing_package_prices_amount_nonnegative check (amount_minor >= 0),
  constraint billing_package_prices_stripe_product_format check (stripe_product_id is null or stripe_product_id ~ '^prod_[A-Za-z0-9]+$'),
  constraint billing_package_prices_stripe_price_format check (stripe_price_id is null or stripe_price_id ~ '^price_[A-Za-z0-9]+$')
);

create unique index billing_package_prices_active_configuration_idx
  on public.billing_package_prices (package_id, currency_code, billing_interval)
  where status <> 'ARCHIVED';
create unique index billing_package_prices_stripe_product_unique_idx
  on public.billing_package_prices (stripe_product_id) where stripe_product_id is not null;
create unique index billing_package_prices_stripe_price_unique_idx
  on public.billing_package_prices (stripe_price_id) where stripe_price_id is not null;

create table public.billing_customers (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  stripe_customer_id text unique,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_stripe_customer_format check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_customers_email_length check (billing_email is null or length(billing_email) <= 254)
);

create table public.tenant_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  billing_customer_id uuid references public.billing_customers(id) on delete restrict,
  package_id uuid not null references public.billing_packages(id) on delete restrict,
  package_price_id uuid references public.billing_package_prices(id) on delete restrict,
  status public.tenant_subscription_status not null default 'INCOMPLETE',
  billing_interval public.billing_interval not null,
  currency_code char(3) not null,
  amount_minor bigint not null,
  package_code_snapshot text not null,
  package_name_snapshot text not null,
  membership_limit_snapshot integer,
  branch_limit_snapshot integer,
  loyalty_card_limit_snapshot integer,
  entitlements_snapshot jsonb not null default '{}'::jsonb,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  stripe_subscription_id text,
  stripe_latest_invoice_id text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_currency_uppercase check (currency_code = upper(currency_code)),
  constraint tenant_subscriptions_amount_nonnegative check (amount_minor >= 0),
  constraint tenant_subscriptions_period_valid check (current_period_end > current_period_start),
  constraint tenant_subscriptions_membership_limit_positive check (membership_limit_snapshot is null or membership_limit_snapshot > 0),
  constraint tenant_subscriptions_branch_limit_positive check (branch_limit_snapshot is null or branch_limit_snapshot > 0),
  constraint tenant_subscriptions_card_limit_supported check (loyalty_card_limit_snapshot is null or loyalty_card_limit_snapshot between 1 and 3),
  constraint tenant_subscriptions_entitlements_object check (jsonb_typeof(entitlements_snapshot) = 'object'),
  constraint tenant_subscriptions_stripe_subscription_format check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  constraint tenant_subscriptions_stripe_invoice_format check (stripe_latest_invoice_id is null or stripe_latest_invoice_id ~ '^in_[A-Za-z0-9]+$')
);

create unique index tenant_subscriptions_one_current_idx
  on public.tenant_subscriptions (tenant_id) where ended_at is null;
create unique index tenant_subscriptions_stripe_unique_idx
  on public.tenant_subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
create index tenant_subscriptions_tenant_created_idx
  on public.tenant_subscriptions (tenant_id, created_at desc);

create table public.billing_membership_usage (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  subscription_id uuid not null references public.tenant_subscriptions(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  current_memberships integer not null default 0,
  peak_memberships integer not null default 0,
  measured_at timestamptz not null default now(),
  stripe_meter_event_identifier text,
  stripe_reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_membership_usage_period_valid check (period_end > period_start),
  constraint billing_membership_usage_counts_nonnegative check (current_memberships >= 0 and peak_memberships >= 0),
  constraint billing_membership_usage_peak_not_lower check (peak_memberships >= current_memberships)
);

create unique index billing_membership_usage_period_unique_idx
  on public.billing_membership_usage (subscription_id, period_start, period_end);
create unique index billing_membership_usage_meter_event_unique_idx
  on public.billing_membership_usage (stripe_meter_event_identifier)
  where stripe_meter_event_identifier is not null;

create table public.billing_promotions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  name text not null,
  description text not null default '',
  status public.billing_catalog_status not null default 'DRAFT',
  discount_type public.billing_discount_type not null,
  percent_off_basis_points integer,
  amount_off_minor bigint,
  currency_code char(3),
  duration public.billing_promotion_duration not null default 'ONCE',
  duration_months integer,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  max_redemptions_per_tenant integer not null default 1,
  membership_coverage_limit integer,
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_promotions_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,49}$'),
  constraint billing_promotions_name_length check (length(btrim(name)) between 2 and 100),
  constraint billing_promotions_description_length check (length(description) <= 500),
  constraint billing_promotions_discount_shape check (
    (discount_type = 'PERCENT' and percent_off_basis_points between 1 and 10000 and amount_off_minor is null and currency_code is null)
    or
    (discount_type = 'FIXED_AMOUNT' and percent_off_basis_points is null and amount_off_minor > 0 and currency_code is not null)
  ),
  constraint billing_promotions_currency_uppercase check (currency_code is null or currency_code = upper(currency_code)),
  constraint billing_promotions_duration_shape check (
    (duration = 'REPEATING' and duration_months > 0)
    or (duration <> 'REPEATING' and duration_months is null)
  ),
  constraint billing_promotions_date_range check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint billing_promotions_max_redemptions_positive check (max_redemptions is null or max_redemptions > 0),
  constraint billing_promotions_per_tenant_positive check (max_redemptions_per_tenant > 0),
  constraint billing_promotions_membership_coverage_positive check (membership_coverage_limit is null or membership_coverage_limit > 0)
);

create unique index billing_promotions_code_unique_idx on public.billing_promotions (upper(code));
create unique index billing_promotions_stripe_coupon_unique_idx
  on public.billing_promotions (stripe_coupon_id) where stripe_coupon_id is not null;
create unique index billing_promotions_stripe_code_unique_idx
  on public.billing_promotions (stripe_promotion_code_id) where stripe_promotion_code_id is not null;

create table public.billing_promotion_packages (
  promotion_id uuid not null references public.billing_promotions(id) on delete restrict,
  package_id uuid not null references public.billing_packages(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (promotion_id, package_id)
);

create table public.billing_affiliates (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  display_name text not null,
  contact_email text,
  status public.billing_catalog_status not null default 'DRAFT',
  commission_type public.affiliate_commission_type not null,
  commission_basis_points integer,
  commission_amount_minor bigint,
  currency_code char(3),
  attribution_window_days integer not null default 30,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_affiliates_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,49}$'),
  constraint billing_affiliates_name_length check (length(btrim(display_name)) between 2 and 120),
  constraint billing_affiliates_email_length check (contact_email is null or length(contact_email) <= 254),
  constraint billing_affiliates_commission_shape check (
    (commission_type = 'PERCENT' and commission_basis_points between 1 and 10000 and commission_amount_minor is null and currency_code is null)
    or
    (commission_type = 'FIXED_AMOUNT' and commission_basis_points is null and commission_amount_minor > 0 and currency_code is not null)
  ),
  constraint billing_affiliates_currency_uppercase check (currency_code is null or currency_code = upper(currency_code)),
  constraint billing_affiliates_window_positive check (attribution_window_days between 1 and 365)
);

create unique index billing_affiliates_code_unique_idx on public.billing_affiliates (upper(code));

create table public.billing_affiliate_referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  affiliate_id uuid not null references public.billing_affiliates(id) on delete restrict,
  attributed_code_snapshot text not null,
  attributed_at timestamptz not null default now(),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_affiliate_referrals_code_not_blank check (length(btrim(attributed_code_snapshot)) > 0)
);

create table public.billing_promotion_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  subscription_id uuid not null references public.tenant_subscriptions(id) on delete restrict,
  promotion_id uuid not null references public.billing_promotions(id) on delete restrict,
  affiliate_referral_id uuid references public.billing_affiliate_referrals(id) on delete restrict,
  promotion_code_snapshot text not null,
  discount_type_snapshot public.billing_discount_type not null,
  percent_off_basis_points_snapshot integer,
  amount_off_minor_snapshot bigint,
  currency_code_snapshot char(3),
  covered_memberships integer not null,
  stripe_discount_id text,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint billing_promotion_redemptions_coverage_positive check (covered_memberships > 0),
  constraint billing_promotion_redemptions_discount_shape check (
    (discount_type_snapshot = 'PERCENT' and percent_off_basis_points_snapshot between 1 and 10000 and amount_off_minor_snapshot is null and currency_code_snapshot is null)
    or
    (discount_type_snapshot = 'FIXED_AMOUNT' and percent_off_basis_points_snapshot is null and amount_off_minor_snapshot > 0 and currency_code_snapshot is not null)
  ),
  constraint billing_promotion_redemptions_currency_uppercase check (currency_code_snapshot is null or currency_code_snapshot = upper(currency_code_snapshot))
);

create index billing_promotion_redemptions_tenant_idx
  on public.billing_promotion_redemptions (tenant_id, redeemed_at desc);
create unique index billing_promotion_redemptions_stripe_unique_idx
  on public.billing_promotion_redemptions (stripe_discount_id) where stripe_discount_id is not null;

create table public.billing_affiliate_commissions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  affiliate_id uuid not null references public.billing_affiliates(id) on delete restrict,
  referral_id uuid not null references public.billing_affiliate_referrals(id) on delete restrict,
  subscription_id uuid not null references public.tenant_subscriptions(id) on delete restrict,
  stripe_invoice_id text,
  gross_amount_minor bigint not null,
  commission_amount_minor bigint not null,
  currency_code char(3) not null,
  status public.affiliate_commission_status not null default 'PENDING',
  approved_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_affiliate_commissions_amounts_nonnegative check (gross_amount_minor >= 0 and commission_amount_minor >= 0),
  constraint billing_affiliate_commissions_currency_uppercase check (currency_code = upper(currency_code)),
  constraint billing_affiliate_commissions_state_dates check (
    (status <> 'APPROVED' or approved_at is not null)
    and (status <> 'PAID' or paid_at is not null)
    and (status <> 'VOID' or voided_at is not null)
  )
);

create unique index billing_affiliate_commissions_invoice_unique_idx
  on public.billing_affiliate_commissions (affiliate_id, stripe_invoice_id)
  where stripe_invoice_id is not null;
create index billing_affiliate_commissions_affiliate_status_idx
  on public.billing_affiliate_commissions (affiliate_id, status, created_at desc);

create table public.stripe_webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  api_version text,
  livemode boolean not null,
  processing_status public.stripe_event_processing_status not null default 'PENDING',
  attempt_count integer not null default 0,
  payload_sha256 text not null,
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint stripe_webhook_events_id_format check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  constraint stripe_webhook_events_type_not_blank check (length(btrim(event_type)) > 0),
  constraint stripe_webhook_events_attempt_nonnegative check (attempt_count >= 0),
  constraint stripe_webhook_events_hash_format check (payload_sha256 ~ '^[a-f0-9]{64}$')
);

create or replace function app.enforce_commercial_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  related_tenant_id uuid;
  related_package_id uuid;
begin
  if tg_table_name = 'tenant_subscriptions' then
    if new.billing_customer_id is not null then
      select tenant_id into related_tenant_id from public.billing_customers where id = new.billing_customer_id;
      if related_tenant_id is distinct from new.tenant_id then
        raise exception 'billing customer tenant must match subscription' using errcode = '23514';
      end if;
    end if;
    if new.package_price_id is not null then
      select package_id into related_package_id from public.billing_package_prices where id = new.package_price_id;
      if related_package_id is distinct from new.package_id then
        raise exception 'billing price package must match subscription package' using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'billing_membership_usage' then
    select tenant_id into related_tenant_id from public.tenant_subscriptions where id = new.subscription_id;
    if related_tenant_id is distinct from new.tenant_id then
      raise exception 'usage tenant must match subscription' using errcode = '23514';
    end if;
  elsif tg_table_name = 'billing_affiliate_referrals' then
    if not exists (select 1 from public.tenants where id = new.tenant_id) then
      raise exception 'referral tenant is unavailable' using errcode = '23514';
    end if;
  elsif tg_table_name = 'billing_promotion_redemptions' then
    select tenant_id into related_tenant_id from public.tenant_subscriptions where id = new.subscription_id;
    if related_tenant_id is distinct from new.tenant_id then
      raise exception 'promotion tenant must match subscription' using errcode = '23514';
    end if;
    if new.affiliate_referral_id is not null and not exists (
      select 1 from public.billing_affiliate_referrals
      where id = new.affiliate_referral_id and tenant_id = new.tenant_id
    ) then
      raise exception 'promotion referral tenant must match' using errcode = '23514';
    end if;
  elsif tg_table_name = 'billing_affiliate_commissions' then
    if not exists (
      select 1
      from public.billing_affiliate_referrals referral
      join public.tenant_subscriptions subscription on subscription.id = new.subscription_id
      where referral.id = new.referral_id
        and referral.tenant_id = new.tenant_id
        and referral.affiliate_id = new.affiliate_id
        and subscription.tenant_id = new.tenant_id
    ) then
      raise exception 'commission tenant, referral and subscription must match' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger tenant_subscriptions_enforce_consistency
  before insert or update on public.tenant_subscriptions
  for each row execute function app.enforce_commercial_tenant_consistency();
create trigger billing_membership_usage_enforce_consistency
  before insert or update on public.billing_membership_usage
  for each row execute function app.enforce_commercial_tenant_consistency();
create trigger billing_affiliate_referrals_enforce_consistency
  before insert or update on public.billing_affiliate_referrals
  for each row execute function app.enforce_commercial_tenant_consistency();
create trigger billing_promotion_redemptions_enforce_consistency
  before insert or update on public.billing_promotion_redemptions
  for each row execute function app.enforce_commercial_tenant_consistency();
create trigger billing_affiliate_commissions_enforce_consistency
  before insert or update on public.billing_affiliate_commissions
  for each row execute function app.enforce_commercial_tenant_consistency();

create or replace function app.current_billable_memberships(target_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select count(*)::integer
  from public.customer_cards card
  join public.customers customer on customer.id = card.customer_id
  where card.tenant_id = target_tenant_id
    and card.status = 'ACTIVE'
    and customer.status = 'ACTIVE';
$$;

create or replace function app.capture_membership_usage(target_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  subscription_record record;
  current_count integer;
begin
  select id, current_period_start, current_period_end
  into subscription_record
  from public.tenant_subscriptions
  where tenant_id = target_tenant_id
    and ended_at is null
    and status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED')
  order by created_at desc
  limit 1;

  if subscription_record.id is null then
    return;
  end if;

  current_count := app.current_billable_memberships(target_tenant_id);

  insert into public.billing_membership_usage (
    tenant_id, subscription_id, period_start, period_end,
    current_memberships, peak_memberships, measured_at
  ) values (
    target_tenant_id, subscription_record.id,
    subscription_record.current_period_start, subscription_record.current_period_end,
    current_count, current_count, now()
  )
  on conflict (subscription_id, period_start, period_end) do update
  set current_memberships = excluded.current_memberships,
      peak_memberships = greatest(
        public.billing_membership_usage.peak_memberships,
        excluded.current_memberships
      ),
      measured_at = excluded.measured_at,
      updated_at = now();
end;
$$;

create or replace function app.capture_membership_usage_from_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform app.capture_membership_usage(coalesce(new.tenant_id, old.tenant_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger customer_cards_capture_billing_usage
  after insert or update of status or delete on public.customer_cards
  for each row execute function app.capture_membership_usage_from_change();
create trigger customers_capture_billing_usage
  after update of status on public.customers
  for each row execute function app.capture_membership_usage_from_change();
create trigger subscriptions_initialize_billing_usage
  after insert or update of status, current_period_start, current_period_end on public.tenant_subscriptions
  for each row execute function app.capture_membership_usage_from_change();

create or replace function app.audit_commercial_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  record_value jsonb := to_jsonb(new);
  tenant_value uuid;
begin
  tenant_value := case when record_value ? 'tenant_id'
    then nullif(record_value->>'tenant_id', '')::uuid else null end;
  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    tenant_value,
    auth.uid(),
    upper(tg_table_name || '_' || tg_op),
    tg_table_name,
    new.id,
    jsonb_build_object('status', record_value->>'status')
  );
  return new;
end;
$$;

create trigger billing_packages_audit after insert or update on public.billing_packages
  for each row execute function app.audit_commercial_change();
create trigger billing_package_prices_audit after insert or update on public.billing_package_prices
  for each row execute function app.audit_commercial_change();
create trigger tenant_subscriptions_audit after insert or update on public.tenant_subscriptions
  for each row execute function app.audit_commercial_change();
create trigger billing_promotions_audit after insert or update on public.billing_promotions
  for each row execute function app.audit_commercial_change();
create trigger billing_affiliates_audit after insert or update on public.billing_affiliates
  for each row execute function app.audit_commercial_change();
create trigger billing_affiliate_referrals_audit after insert or update on public.billing_affiliate_referrals
  for each row execute function app.audit_commercial_change();
create trigger billing_affiliate_commissions_audit after insert or update on public.billing_affiliate_commissions
  for each row execute function app.audit_commercial_change();

create trigger billing_packages_set_updated_at before update on public.billing_packages
  for each row execute function app.set_updated_at();
create trigger billing_package_prices_set_updated_at before update on public.billing_package_prices
  for each row execute function app.set_updated_at();
create trigger billing_customers_set_updated_at before update on public.billing_customers
  for each row execute function app.set_updated_at();
create trigger tenant_subscriptions_set_updated_at before update on public.tenant_subscriptions
  for each row execute function app.set_updated_at();
create trigger billing_membership_usage_set_updated_at before update on public.billing_membership_usage
  for each row execute function app.set_updated_at();
create trigger billing_promotions_set_updated_at before update on public.billing_promotions
  for each row execute function app.set_updated_at();
create trigger billing_affiliates_set_updated_at before update on public.billing_affiliates
  for each row execute function app.set_updated_at();
create trigger billing_affiliate_commissions_set_updated_at before update on public.billing_affiliate_commissions
  for each row execute function app.set_updated_at();
create trigger stripe_webhook_events_set_updated_at before update on public.stripe_webhook_events
  for each row execute function app.set_updated_at();

create function app.create_billing_package(
  target_code text,
  target_name text,
  target_description text,
  target_membership_limit integer,
  target_branch_limit integer,
  target_loyalty_card_limit integer,
  target_entitlements jsonb,
  target_currency_code text,
  target_billing_interval public.billing_interval,
  target_amount_minor bigint
)
returns table (result text, package_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  package_id_value uuid;
begin
  if not app.is_superadmin() then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  insert into public.billing_packages (
    code, name, description, status, membership_limit, branch_limit,
    loyalty_card_limit, entitlements, created_by_staff_id, updated_by_staff_id
  ) values (
    lower(btrim(target_code)), btrim(target_name), btrim(target_description),
    'DRAFT', target_membership_limit, target_branch_limit,
    target_loyalty_card_limit, coalesce(target_entitlements, '{}'::jsonb),
    actor_id, actor_id
  ) returning id into package_id_value;

  insert into public.billing_package_prices (
    package_id, currency_code, billing_interval, amount_minor, status,
    created_by_staff_id, updated_by_staff_id
  ) values (
    package_id_value, upper(btrim(target_currency_code)),
    target_billing_interval, target_amount_minor, 'DRAFT', actor_id, actor_id
  );

  return query select 'CREATED', package_id_value;
exception when check_violation or unique_violation then
  return query select 'INVALID', null::uuid;
end;
$$;

create function app.set_billing_package_status(
  target_package_id uuid,
  target_status public.billing_catalog_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
begin
  if not app.is_superadmin() or target_status = 'DRAFT' then
    return 'UNAVAILABLE';
  end if;

  update public.billing_packages
  set status = target_status, updated_by_staff_id = actor_id
  where id = target_package_id and status <> target_status;

  if not found then
    return case when exists (
      select 1 from public.billing_packages
      where id = target_package_id and status = target_status
    ) then 'UNCHANGED' else 'UNAVAILABLE' end;
  end if;

  update public.billing_package_prices
  set status = target_status, updated_by_staff_id = actor_id
  where package_id = target_package_id and status <> target_status;

  return case when target_status = 'ACTIVE' then 'ACTIVATED' else 'ARCHIVED' end;
end;
$$;

alter table public.billing_packages enable row level security;
alter table public.billing_package_prices enable row level security;
alter table public.billing_customers enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.billing_membership_usage enable row level security;
alter table public.billing_promotions enable row level security;
alter table public.billing_promotion_packages enable row level security;
alter table public.billing_promotion_redemptions enable row level security;
alter table public.billing_affiliates enable row level security;
alter table public.billing_affiliate_referrals enable row level security;
alter table public.billing_affiliate_commissions enable row level security;
alter table public.stripe_webhook_events enable row level security;

alter table public.billing_packages force row level security;
alter table public.billing_package_prices force row level security;
alter table public.billing_customers force row level security;
alter table public.tenant_subscriptions force row level security;
alter table public.billing_membership_usage force row level security;
alter table public.billing_promotions force row level security;
alter table public.billing_promotion_packages force row level security;
alter table public.billing_promotion_redemptions force row level security;
alter table public.billing_affiliates force row level security;
alter table public.billing_affiliate_referrals force row level security;
alter table public.billing_affiliate_commissions force row level security;
alter table public.stripe_webhook_events force row level security;

create policy billing_packages_superadmin_all on public.billing_packages
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_packages_tenant_admin_read_active on public.billing_packages
  for select to authenticated using (
    status = 'ACTIVE' and app.current_staff_is_active()
    and app.current_tenant_is_active() and app.current_staff_role() = 'ADMIN'
  );
create policy billing_package_prices_superadmin_all on public.billing_package_prices
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_package_prices_tenant_admin_read_active on public.billing_package_prices
  for select to authenticated using (
    status = 'ACTIVE' and app.current_staff_is_active()
    and app.current_tenant_is_active() and app.current_staff_role() = 'ADMIN'
  );
create policy billing_promotions_superadmin_all on public.billing_promotions
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_promotions_tenant_admin_read_active on public.billing_promotions
  for select to authenticated using (
    status = 'ACTIVE' and app.current_staff_is_active()
    and app.current_tenant_is_active() and app.current_staff_role() = 'ADMIN'
  );
create policy billing_promotion_packages_superadmin_all on public.billing_promotion_packages
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_promotion_packages_tenant_admin_read_active on public.billing_promotion_packages
  for select to authenticated using (
    app.current_staff_is_active() and app.current_tenant_is_active()
    and app.current_staff_role() = 'ADMIN'
    and exists (select 1 from public.billing_promotions promotion where promotion.id = promotion_id and promotion.status = 'ACTIVE')
    and exists (select 1 from public.billing_packages package where package.id = package_id and package.status = 'ACTIVE')
  );
create policy billing_affiliates_superadmin_all on public.billing_affiliates
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

create policy billing_customers_superadmin_all on public.billing_customers
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_customers_tenant_admin_read on public.billing_customers
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );
create policy tenant_subscriptions_superadmin_all on public.tenant_subscriptions
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy tenant_subscriptions_tenant_admin_read on public.tenant_subscriptions
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );
create policy billing_membership_usage_superadmin_all on public.billing_membership_usage
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_membership_usage_tenant_admin_read on public.billing_membership_usage
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );
create policy billing_promotion_redemptions_superadmin_all on public.billing_promotion_redemptions
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_promotion_redemptions_tenant_admin_read on public.billing_promotion_redemptions
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );
create policy billing_affiliate_referrals_superadmin_all on public.billing_affiliate_referrals
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_affiliate_referrals_tenant_admin_read on public.billing_affiliate_referrals
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );
create policy billing_affiliate_commissions_superadmin_all on public.billing_affiliate_commissions
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());
create policy billing_affiliate_commissions_tenant_admin_read on public.billing_affiliate_commissions
  for select to authenticated using (
    tenant_id = app.current_staff_tenant_id() and app.current_staff_role() = 'ADMIN'
    and app.current_staff_is_active() and app.current_tenant_is_active()
  );

revoke all on public.billing_packages, public.billing_package_prices,
  public.billing_customers, public.tenant_subscriptions,
  public.billing_membership_usage, public.billing_promotions,
  public.billing_promotion_packages, public.billing_promotion_redemptions,
  public.billing_affiliates, public.billing_affiliate_referrals,
  public.billing_affiliate_commissions, public.stripe_webhook_events from anon;

grant select, insert, update on public.billing_packages, public.billing_package_prices,
  public.billing_promotions, public.billing_promotion_packages,
  public.billing_affiliates to authenticated;
grant select, insert, update on public.billing_customers,
  public.tenant_subscriptions, public.billing_membership_usage,
  public.billing_promotion_redemptions, public.billing_affiliate_referrals,
  public.billing_affiliate_commissions to authenticated;
revoke all on public.stripe_webhook_events from authenticated;

revoke all on function app.current_billable_memberships(uuid) from public, anon, authenticated;
revoke all on function app.capture_membership_usage(uuid) from public, anon, authenticated;
grant execute on function app.current_billable_memberships(uuid) to service_role;
grant execute on function app.capture_membership_usage(uuid) to service_role;
revoke all on function app.create_billing_package(text, text, text, integer, integer, integer, jsonb, text, public.billing_interval, bigint) from public, anon;
revoke all on function app.set_billing_package_status(uuid, public.billing_catalog_status) from public, anon;
grant execute on function app.create_billing_package(text, text, text, integer, integer, integer, jsonb, text, public.billing_interval, bigint) to authenticated;
grant execute on function app.set_billing_package_status(uuid, public.billing_catalog_status) to authenticated;
