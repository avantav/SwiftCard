-- Service orders: per-tenant commercial conditions (DEC-0076).
--
-- When a business has a price, plan or scope different from the published
-- plans, the Superadmin records a Service Order: plan, price (minor units,
-- before VAT), periodicity, what is included and excluded, and validity. The
-- Admin general accepts it in /admin/billing; the acceptance (who, when) is the
-- evidence of the business's conformity with what it pays and what it gets
-- (Terms §4).
--
-- * Orders are append-only versions per tenant. Once accepted an order is
--   immutable; to change conditions the Superadmin issues a new version.
-- * Created only through app.create_tenant_service_order (Superadmin) and
--   accepted only through app.accept_my_service_order (the real Admin general,
--   never a support session). Both are audited.
-- * RLS: the tenant's Admin general and the Superadmin can read; nobody
--   writes directly.

create table public.tenant_service_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  version integer not null,
  plan_name text not null,
  price_minor bigint not null,
  currency_code text not null default 'MXN',
  billing_interval text not null,
  included_scope text not null,
  excluded_scope text not null,
  starts_on date not null,
  ends_on date,
  created_by_staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  accepted_by_staff_id uuid references public.staff_profiles(id) on delete restrict,
  accepted_at timestamptz,
  constraint tenant_service_orders_version_unique unique (tenant_id, version),
  constraint tenant_service_orders_version_positive check (version > 0),
  constraint tenant_service_orders_plan_length check (length(btrim(plan_name)) between 2 and 80),
  constraint tenant_service_orders_price_nonnegative check (price_minor >= 0),
  constraint tenant_service_orders_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint tenant_service_orders_interval_valid check (billing_interval in ('MONTH', 'YEAR', 'ONE_TIME')),
  constraint tenant_service_orders_included_length check (length(btrim(included_scope)) between 10 and 4000),
  constraint tenant_service_orders_excluded_length check (length(btrim(excluded_scope)) between 10 and 4000),
  constraint tenant_service_orders_dates check (ends_on is null or ends_on >= starts_on),
  constraint tenant_service_orders_acceptance_consistency check (
    (accepted_at is null) = (accepted_by_staff_id is null)
  )
);

create index tenant_service_orders_tenant_idx
  on public.tenant_service_orders (tenant_id, version desc);

alter table public.tenant_service_orders enable row level security;
alter table public.tenant_service_orders force row level security;

create policy tenant_service_orders_read on public.tenant_service_orders
  for select to authenticated
  using (
    app.is_superadmin()
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid() and sp.tenant_id = tenant_service_orders.tenant_id
        and sp.role = 'ADMIN' and sp.status = 'ACTIVE'
    )
  );

revoke all on public.tenant_service_orders from public, anon, authenticated;
grant select on public.tenant_service_orders to authenticated;

-- Immutability: no deletes; the only allowed update records the acceptance
-- of an order that was not accepted yet.
create function app.protect_tenant_service_orders()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'service_order_immutable' using errcode = '55000';
  end if;
  if old.accepted_at is not null
    or new.accepted_at is null
    or (to_jsonb(new) - 'accepted_at' - 'accepted_by_staff_id')
       is distinct from (to_jsonb(old) - 'accepted_at' - 'accepted_by_staff_id') then
    raise exception 'service_order_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger tenant_service_orders_protect
before update or delete on public.tenant_service_orders
for each row execute function app.protect_tenant_service_orders();

create function app.create_tenant_service_order(
  target_tenant_id uuid,
  target_plan_name text,
  target_price_minor bigint,
  target_currency_code text,
  target_billing_interval text,
  target_included_scope text,
  target_excluded_scope text,
  target_starts_on date,
  target_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  next_version integer;
  order_id uuid;
begin
  if not app.is_superadmin() then
    raise exception 'service_order_forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = target_tenant_id) then
    raise exception 'service_order_tenant_missing' using errcode = '22023';
  end if;

  -- Serialize versions per tenant.
  perform 1 from public.tenants where id = target_tenant_id for update;
  select coalesce(max(version), 0) + 1 into next_version
  from public.tenant_service_orders where tenant_id = target_tenant_id;

  insert into public.tenant_service_orders (
    tenant_id, version, plan_name, price_minor, currency_code, billing_interval,
    included_scope, excluded_scope, starts_on, ends_on, created_by_staff_id
  ) values (
    target_tenant_id, next_version, btrim(target_plan_name), target_price_minor,
    upper(btrim(coalesce(target_currency_code, 'MXN'))), target_billing_interval,
    btrim(target_included_scope), btrim(target_excluded_scope),
    target_starts_on, target_ends_on, auth.uid()
  ) returning id into order_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    target_tenant_id, auth.uid(), 'SERVICE_ORDER_CREATED', 'tenant_service_orders', order_id,
    jsonb_build_object(
      'version', next_version,
      'plan_name', btrim(target_plan_name),
      'price_minor', target_price_minor,
      'billing_interval', target_billing_interval
    )
  );
  return order_id;
end;
$$;

create function app.accept_my_service_order(target_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  order_record record;
  latest_version integer;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select * into order_record
  from public.tenant_service_orders
  where id = target_order_id and tenant_id = staff_record.tenant_id
  for update;

  if staff_record.id is null or order_record.id is null then
    return 'UNAVAILABLE';
  end if;
  if order_record.accepted_at is not null then
    return 'ALREADY_ACCEPTED';
  end if;
  select max(version) into latest_version
  from public.tenant_service_orders where tenant_id = staff_record.tenant_id;
  if order_record.version <> latest_version then
    return 'SUPERSEDED';
  end if;

  update public.tenant_service_orders
  set accepted_at = now(), accepted_by_staff_id = staff_record.id
  where id = order_record.id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'SERVICE_ORDER_ACCEPTED', 'tenant_service_orders', order_record.id,
    jsonb_build_object(
      'version', order_record.version,
      'price_minor', order_record.price_minor,
      'billing_interval', order_record.billing_interval
    )
  );
  return 'ACCEPTED';
end;
$$;

revoke all on function app.create_tenant_service_order(uuid, text, bigint, text, text, text, text, date, date) from public, anon, authenticated;
revoke all on function app.accept_my_service_order(uuid) from public, anon, authenticated;
grant execute on function app.create_tenant_service_order(uuid, text, bigint, text, text, text, text, date, date) to authenticated;
grant execute on function app.accept_my_service_order(uuid) to authenticated;
