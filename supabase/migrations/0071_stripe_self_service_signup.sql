-- Public self-service signup with Stripe Checkout (Inicial and Crecimiento).
-- A signup intent is recorded before Checkout; the tenant, its first
-- Administrator and the billing customer are provisioned only after Stripe
-- confirms the checkout through a verified webhook. See DEC-0058.

create type public.billing_signup_status as enum ('PENDING', 'COMPLETED', 'EXPIRED');

create table public.billing_signup_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  package_id uuid not null references public.billing_packages(id) on delete restrict,
  package_price_id uuid not null references public.billing_package_prices(id) on delete restrict,
  business_name text not null,
  admin_full_name text not null,
  email text not null,
  phone text,
  auth_user_id uuid not null,
  status public.billing_signup_status not null default 'PENDING',
  stripe_checkout_session_id text unique,
  tenant_id uuid references public.tenants(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_signup_intents_business_name_length check (length(btrim(business_name)) between 2 and 120),
  constraint billing_signup_intents_admin_name_length check (length(btrim(admin_full_name)) between 2 and 120),
  constraint billing_signup_intents_email_format check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(email) <= 254),
  constraint billing_signup_intents_phone_length check (phone is null or length(phone) <= 30),
  constraint billing_signup_intents_checkout_format check (stripe_checkout_session_id is null or stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  constraint billing_signup_intents_completion check (
    (status = 'COMPLETED' and tenant_id is not null and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  )
);

create index billing_signup_intents_email_idx
  on public.billing_signup_intents (email, created_at desc);

create trigger billing_signup_intents_set_updated_at
  before update on public.billing_signup_intents
  for each row execute function app.set_updated_at();

alter table public.billing_signup_intents enable row level security;
alter table public.billing_signup_intents force row level security;
revoke all on public.billing_signup_intents from public, anon, authenticated;
grant select, insert, update on public.billing_signup_intents to service_role;

-- Provisions tenant + first Administrator + billing customer for a paid
-- (or trialing) checkout. Idempotent: a completed intent returns its tenant.
create function app.provision_self_service_tenant(
  target_intent_id uuid,
  target_stripe_customer_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  intent public.billing_signup_intents%rowtype;
  tenant_id_value uuid;
begin
  if target_stripe_customer_id is null or target_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'invalid Stripe customer' using errcode = '22023';
  end if;

  select * into intent
  from public.billing_signup_intents
  where id = target_intent_id
  for update;

  if not found then
    raise exception 'signup intent does not exist' using errcode = '23503';
  end if;

  if intent.status = 'COMPLETED' then
    return intent.tenant_id;
  end if;

  if exists (select 1 from public.staff_profiles sp where sp.id = intent.auth_user_id) then
    raise exception 'signup user already has a profile' using errcode = '23505';
  end if;

  insert into public.tenants (name, contact_name, contact_email, contact_phone, status, currency_code)
  values (btrim(intent.business_name), btrim(intent.admin_full_name), intent.email, intent.phone, 'ACTIVE', 'MXN')
  returning id into tenant_id_value;

  insert into public.staff_profiles (id, tenant_id, email, full_name, role, status)
  values (intent.auth_user_id, tenant_id_value, intent.email, btrim(intent.admin_full_name), 'ADMIN', 'ACTIVE');

  insert into public.billing_customers (tenant_id, stripe_customer_id, billing_email)
  values (tenant_id_value, target_stripe_customer_id, intent.email);

  update public.billing_signup_intents
  set status = 'COMPLETED', tenant_id = tenant_id_value, completed_at = now()
  where id = intent.id;

  return tenant_id_value;
end;
$$;

-- Creates or updates the tenant subscription mirrored from Stripe. Contract
-- snapshots are taken from the local catalog on creation and never rewritten.
create function app.sync_stripe_subscription(
  target_tenant_id uuid,
  target_package_price_id uuid,
  target_stripe_subscription_id text,
  target_status public.tenant_subscription_status,
  target_period_start timestamptz,
  target_period_end timestamptz,
  target_trial_ends_at timestamptz,
  target_cancel_at_period_end boolean,
  target_canceled_at timestamptz,
  target_ended_at timestamptz,
  target_latest_invoice_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  subscription_id_value uuid;
  price_record record;
  customer_id_value uuid;
begin
  if target_stripe_subscription_id is null or target_stripe_subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise exception 'invalid Stripe subscription' using errcode = '22023';
  end if;

  select id into subscription_id_value
  from public.tenant_subscriptions
  where stripe_subscription_id = target_stripe_subscription_id
  for update;

  if found then
    update public.tenant_subscriptions
    set
      status = target_status,
      current_period_start = target_period_start,
      current_period_end = target_period_end,
      trial_ends_at = target_trial_ends_at,
      cancel_at_period_end = coalesce(target_cancel_at_period_end, false),
      canceled_at = target_canceled_at,
      ended_at = target_ended_at,
      stripe_latest_invoice_id = coalesce(target_latest_invoice_id, stripe_latest_invoice_id)
    where id = subscription_id_value;
    return subscription_id_value;
  end if;

  select
    pr.id as price_id, pr.billing_interval, pr.currency_code, pr.amount_minor,
    pk.id as package_id, pk.code, pk.name, pk.membership_limit, pk.branch_limit,
    pk.loyalty_card_limit, pk.entitlements
  into price_record
  from public.billing_package_prices pr
  join public.billing_packages pk on pk.id = pr.package_id
  where pr.id = target_package_price_id;

  if not found then
    raise exception 'package price does not exist' using errcode = '23503';
  end if;

  select id into customer_id_value
  from public.billing_customers
  where tenant_id = target_tenant_id;

  -- A tenant keeps one current subscription; end any previous open one.
  update public.tenant_subscriptions
  set ended_at = coalesce(ended_at, now()), status = 'CANCELED'
  where tenant_id = target_tenant_id and ended_at is null;

  insert into public.tenant_subscriptions (
    tenant_id, billing_customer_id, package_id, package_price_id, status,
    billing_interval, currency_code, amount_minor, package_code_snapshot,
    package_name_snapshot, membership_limit_snapshot, branch_limit_snapshot,
    loyalty_card_limit_snapshot, entitlements_snapshot, current_period_start,
    current_period_end, trial_ends_at, cancel_at_period_end, canceled_at,
    ended_at, stripe_subscription_id, stripe_latest_invoice_id
  ) values (
    target_tenant_id, customer_id_value, price_record.package_id, price_record.price_id,
    target_status, price_record.billing_interval, price_record.currency_code,
    price_record.amount_minor, price_record.code, price_record.name,
    price_record.membership_limit, price_record.branch_limit,
    price_record.loyalty_card_limit, price_record.entitlements, target_period_start,
    target_period_end, target_trial_ends_at, coalesce(target_cancel_at_period_end, false),
    target_canceled_at, target_ended_at, target_stripe_subscription_id,
    target_latest_invoice_id
  )
  returning id into subscription_id_value;

  return subscription_id_value;
end;
$$;

revoke all on function app.provision_self_service_tenant(uuid, text) from public, anon, authenticated;
revoke all on function app.sync_stripe_subscription(
  uuid, uuid, text, public.tenant_subscription_status, timestamptz, timestamptz,
  timestamptz, boolean, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function app.provision_self_service_tenant(uuid, text) to service_role;
grant execute on function app.sync_stripe_subscription(
  uuid, uuid, text, public.tenant_subscription_status, timestamptz, timestamptz,
  timestamptz, boolean, timestamptz, timestamptz, text
) to service_role;

notify pgrst, 'reload schema';
