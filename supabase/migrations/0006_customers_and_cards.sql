-- Phase 2 foundation: customers, one card per tenant, public token boundary, and RLS.

create type public.customer_registration_method as enum ('SELF_SERVICE', 'EMPLOYEE');
create type public.customer_status as enum ('ACTIVE', 'INACTIVE');
create type public.customer_card_status as enum ('ACTIVE', 'REVOKED');

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  full_name text not null,
  normalized_phone text not null,
  email text,
  birth_date date,
  privacy_consent boolean not null default false,
  registration_method public.customer_registration_method not null,
  source_branch_id uuid not null references public.branches(id) on delete restrict,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  status public.customer_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(btrim(full_name)) > 0),
  constraint customers_phone_not_blank check (length(btrim(normalized_phone)) > 0),
  constraint customers_employee_registration_has_creator check (
    (registration_method = 'SELF_SERVICE')
    or created_by_staff_id is not null
  )
);

create table public.customer_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete cascade,
  public_token text not null default replace(
    replace(
      rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
      '+',
      '-'
    ),
    '/',
    '_'
  ),
  token_version integer not null default 1,
  status public.customer_card_status not null default 'ACTIVE',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_cards_token_not_blank check (length(public_token) >= 40),
  constraint customer_cards_token_version_positive check (token_version > 0),
  constraint customer_cards_revoked_at_consistency check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
  )
);

create unique index customers_tenant_phone_unique_idx
  on public.customers (tenant_id, normalized_phone);

create unique index customer_cards_one_per_customer_idx
  on public.customer_cards (customer_id);

create unique index customer_cards_public_token_unique_idx
  on public.customer_cards (public_token);

create index customers_tenant_status_idx
  on public.customers (tenant_id, status);

create index customers_source_branch_idx
  on public.customers (source_branch_id);

create index customer_cards_tenant_status_idx
  on public.customer_cards (tenant_id, status);

create or replace function app.enforce_customer_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  branch_tenant_id uuid;
  creator_tenant_id uuid;
begin
  select b.tenant_id into branch_tenant_id
  from public.branches b
  where b.id = new.source_branch_id;

  if branch_tenant_id is distinct from new.tenant_id then
    raise exception 'customer source branch tenant must match'
      using errcode = '23514';
  end if;

  if new.created_by_staff_id is not null then
    select sp.tenant_id into creator_tenant_id
    from public.staff_profiles sp
    where sp.id = new.created_by_staff_id;

    if creator_tenant_id is distinct from new.tenant_id then
      raise exception 'customer creator tenant must match'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger customers_enforce_tenant
  before insert or update on public.customers
  for each row execute function app.enforce_customer_tenant_consistency();

create or replace function app.enforce_customer_card_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  customer_tenant_id uuid;
begin
  select c.tenant_id into customer_tenant_id
  from public.customers c
  where c.id = new.customer_id;

  if customer_tenant_id is distinct from new.tenant_id then
    raise exception 'customer card tenant must match customer'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger customer_cards_enforce_tenant
  before insert or update on public.customer_cards
  for each row execute function app.enforce_customer_card_tenant_consistency();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

create trigger customer_cards_set_updated_at
  before update on public.customer_cards
  for each row execute function app.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_cards enable row level security;
alter table public.customers force row level security;
alter table public.customer_cards force row level security;

create policy customers_superadmin_all
  on public.customers for all to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy customers_admin_all
  on public.customers for all to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id))
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy customers_staff_select_assigned_branch
  on public.customers for select to authenticated
  using (app.current_staff_can_access_branch(source_branch_id));

create policy customer_cards_superadmin_all
  on public.customer_cards for all to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy customer_cards_admin_all
  on public.customer_cards for all to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id))
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy customer_cards_staff_select_assigned_branch
  on public.customer_cards for select to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_id
        and app.current_staff_can_access_branch(c.source_branch_id)
    )
  );

revoke all on public.customers, public.customer_cards from anon;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_cards to authenticated;
revoke all on all functions in schema app from anon;
