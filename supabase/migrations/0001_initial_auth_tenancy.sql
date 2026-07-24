-- SwiftWallet Phase 1 foundation: tenants, branches, staff profiles, assignments, and RLS.
-- This migration assumes the Supabase-managed auth schema is available.

create schema if not exists app;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create type public.tenant_status as enum ('ACTIVE', 'SUSPENDED');
create type public.branding_mode as enum ('STANDARD', 'WHITE_LABEL');
create type public.branch_status as enum ('ACTIVE', 'INACTIVE');
create type public.staff_role as enum ('SUPERADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE');
create type public.staff_status as enum ('ACTIVE', 'INACTIVE', 'PASSWORD_RESET_REQUIRED');

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  status public.tenant_status not null default 'ACTIVE',
  currency_code char(3) not null default 'MXN',
  timezone text not null default 'America/Mazatlan',
  branding_mode public.branding_mode not null default 'STANDARD',
  logo_url text,
  banner_url text,
  primary_color text not null default '#149C91',
  secondary_color text not null default '#17202A',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_name_not_blank check (length(btrim(name)) > 0),
  constraint tenants_currency_code_uppercase check (currency_code = upper(currency_code)),
  constraint tenants_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.branches (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  geofence_radius_meters integer not null default 100,
  status public.branch_status not null default 'ACTIVE',
  public_registration_token text not null default replace(
    replace(
      rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
      '+',
      '-'
    ),
    '/',
    '_'
  ),
  proximity_enabled boolean not null default true,
  proximity_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_name_not_blank check (length(btrim(name)) > 0),
  constraint branches_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint branches_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint branches_geofence_radius_positive check (geofence_radius_meters > 0)
);

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete restrict,
  email text not null,
  full_name text not null,
  role public.staff_role not null,
  status public.staff_status not null default 'PASSWORD_RESET_REQUIRED',
  temporary_password_expires_at timestamptz,
  last_password_change_at timestamptz,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_email_not_blank check (length(btrim(email)) > 0),
  constraint staff_profiles_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint staff_profiles_superadmin_has_no_tenant check (
    (role = 'SUPERADMIN' and tenant_id is null)
    or (role <> 'SUPERADMIN' and tenant_id is not null)
  )
);

create table public.staff_branch_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  is_primary boolean not null default false,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_branch_assignments_unique unique (staff_profile_id, branch_id)
);

create unique index tenants_contact_email_unique_idx
  on public.tenants (lower(contact_email))
  where contact_email is not null;

create unique index branches_registration_token_unique_idx
  on public.branches (public_registration_token);

create index branches_tenant_id_idx on public.branches (tenant_id);
create index branches_tenant_status_idx on public.branches (tenant_id, status);

create unique index staff_profiles_email_unique_idx on public.staff_profiles (lower(email));
create index staff_profiles_tenant_id_idx on public.staff_profiles (tenant_id);
create index staff_profiles_tenant_role_idx on public.staff_profiles (tenant_id, role);
create index staff_profiles_tenant_status_idx on public.staff_profiles (tenant_id, status);

create index staff_branch_assignments_tenant_id_idx on public.staff_branch_assignments (tenant_id);
create index staff_branch_assignments_staff_profile_id_idx on public.staff_branch_assignments (staff_profile_id);
create index staff_branch_assignments_branch_id_idx on public.staff_branch_assignments (branch_id);
create unique index staff_branch_assignments_one_primary_idx
  on public.staff_branch_assignments (staff_profile_id)
  where is_primary;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function app.set_updated_at();

create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function app.set_updated_at();

create or replace function app.enforce_staff_branch_assignment_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  staff_role_value public.staff_role;
  branch_tenant_id uuid;
begin
  select sp.tenant_id, sp.role
    into staff_tenant_id, staff_role_value
  from public.staff_profiles sp
  where sp.id = new.staff_profile_id;

  if staff_tenant_id is null or staff_role_value = 'SUPERADMIN' then
    raise exception 'branch assignments require tenant staff'
      using errcode = '23514';
  end if;

  select b.tenant_id
    into branch_tenant_id
  from public.branches b
  where b.id = new.branch_id;

  if staff_tenant_id is distinct from new.tenant_id
    or branch_tenant_id is distinct from new.tenant_id then
    raise exception 'staff and branch assignment tenants must match'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger staff_branch_assignments_enforce_tenant
  before insert or update on public.staff_branch_assignments
  for each row execute function app.enforce_staff_branch_assignment_tenant();

create or replace function app.current_staff_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.id = auth.uid();
$$;

create or replace function app.current_staff_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select sp.tenant_id
  from public.staff_profiles sp
  where sp.id = auth.uid();
$$;

create or replace function app.current_staff_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(sp.status = 'ACTIVE', false)
  from public.staff_profiles sp
  where sp.id = auth.uid();
$$;

create or replace function app.current_tenant_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(t.status = 'ACTIVE', false)
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid();
$$;

create or replace function app.current_staff_can_view_self_profile()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(
    (sp.role = 'SUPERADMIN' and sp.status = 'ACTIVE')
    or (
      sp.role <> 'SUPERADMIN'
      and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')
      and t.status = 'ACTIVE'
    ),
    false
  )
  from public.staff_profiles sp
  left join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
$$;

create or replace function app.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(sp.role = 'SUPERADMIN' and sp.status = 'ACTIVE', false)
  from public.staff_profiles sp
  where sp.id = auth.uid();
$$;

create or replace function app.current_staff_can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select app.is_superadmin()
    or coalesce(
      app.current_staff_is_active()
      and app.current_tenant_is_active()
      and app.current_staff_tenant_id() = target_tenant_id,
      false
    );
$$;

create or replace function app.current_staff_can_manage_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select app.is_superadmin()
    or coalesce(
      app.current_staff_is_active()
      and app.current_tenant_is_active()
      and app.current_staff_tenant_id() = target_tenant_id
      and app.current_staff_role() = 'ADMIN',
      false
    );
$$;

create or replace function app.current_staff_can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select app.is_superadmin()
    or exists (
      select 1
      from public.branches b
      where b.id = target_branch_id
        and app.current_staff_is_active()
        and app.current_tenant_is_active()
        and b.tenant_id = app.current_staff_tenant_id()
        and (
          app.current_staff_role() = 'ADMIN'
          or exists (
            select 1
            from public.staff_branch_assignments sba
            where sba.branch_id = target_branch_id
              and sba.staff_profile_id = auth.uid()
          )
        )
    );
$$;

alter table public.tenants enable row level security;
alter table public.branches enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_branch_assignments enable row level security;

alter table public.tenants force row level security;
alter table public.branches force row level security;
alter table public.staff_profiles force row level security;
alter table public.staff_branch_assignments force row level security;

create policy tenants_superadmin_all
  on public.tenants
  for all
  to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy tenants_staff_select_own_active
  on public.tenants
  for select
  to authenticated
  using (app.current_staff_can_access_tenant(id));

create policy branches_superadmin_all
  on public.branches
  for all
  to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy branches_staff_select_accessible
  on public.branches
  for select
  to authenticated
  using (app.current_staff_can_access_branch(id));

create policy branches_admin_insert_own_tenant
  on public.branches
  for insert
  to authenticated
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy branches_admin_update_own_tenant
  on public.branches
  for update
  to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id))
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy staff_profiles_superadmin_all
  on public.staff_profiles
  for all
  to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy staff_profiles_select_self
  on public.staff_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    and app.current_staff_can_view_self_profile()
  );

create policy staff_profiles_tenant_staff_select
  on public.staff_profiles
  for select
  to authenticated
  using (
    tenant_id = app.current_staff_tenant_id()
    and app.current_staff_is_active()
    and app.current_tenant_is_active()
    and app.current_staff_role() in ('ADMIN', 'MANAGER')
  );

create policy staff_profiles_admin_insert_own_tenant
  on public.staff_profiles
  for insert
  to authenticated
  with check (
    app.current_staff_can_manage_tenant(tenant_id)
    and role <> 'SUPERADMIN'
  );

create policy staff_profiles_admin_update_own_tenant
  on public.staff_profiles
  for update
  to authenticated
  using (
    tenant_id = app.current_staff_tenant_id()
    and app.current_staff_can_manage_tenant(tenant_id)
    and role <> 'SUPERADMIN'
  )
  with check (
    tenant_id = app.current_staff_tenant_id()
    and app.current_staff_can_manage_tenant(tenant_id)
    and role <> 'SUPERADMIN'
  );

create policy staff_branch_assignments_superadmin_all
  on public.staff_branch_assignments
  for all
  to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy staff_branch_assignments_select_accessible
  on public.staff_branch_assignments
  for select
  to authenticated
  using (
    app.current_staff_can_manage_tenant(tenant_id)
    or (
      staff_profile_id = auth.uid()
      and app.current_staff_is_active()
      and app.current_tenant_is_active()
    )
    or app.current_staff_can_access_branch(branch_id)
  );

create policy staff_branch_assignments_admin_insert_own_tenant
  on public.staff_branch_assignments
  for insert
  to authenticated
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy staff_branch_assignments_admin_update_own_tenant
  on public.staff_branch_assignments
  for update
  to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id))
  with check (app.current_staff_can_manage_tenant(tenant_id));

create policy staff_branch_assignments_admin_delete_own_tenant
  on public.staff_branch_assignments
  for delete
  to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id));

revoke all on schema app from anon;
grant usage on schema app to authenticated;

grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.staff_branch_assignments to authenticated;

revoke all on all functions in schema app from anon;
grant execute on all functions in schema app to authenticated;
