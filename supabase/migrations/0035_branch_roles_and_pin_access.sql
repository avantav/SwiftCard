-- Branch-scoped administrators and optional shared employee access with personal PIN attribution.

create type public.branch_employee_access_mode as enum (
  'INDIVIDUAL_CREDENTIALS',
  'SHARED_ACCOUNT_PIN'
);

create type public.staff_account_kind as enum (
  'INDIVIDUAL',
  'BRANCH_SHARED'
);

create type public.pin_operator_status as enum ('ACTIVE', 'INACTIVE');

alter table public.branches
  add column employee_access_mode public.branch_employee_access_mode
  not null default 'INDIVIDUAL_CREDENTIALS';

alter table public.staff_profiles
  add column account_kind public.staff_account_kind
  not null default 'INDIVIDUAL';

create table public.branch_shared_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null unique references public.branches(id) on delete restrict,
  staff_profile_id uuid not null unique references public.staff_profiles(id) on delete restrict,
  active boolean not null default true,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_shared_accounts_failed_attempts_nonnegative
    check (failed_pin_attempts >= 0)
);

create table public.branch_pin_operators (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  full_name text not null,
  pin_hash text not null,
  status public.pin_operator_status not null default 'ACTIVE',
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_pin_operators_name_not_blank check (length(btrim(full_name)) > 0),
  constraint branch_pin_operators_pin_hash_not_blank check (length(pin_hash) > 20)
);

create index branch_pin_operators_branch_status_idx
  on public.branch_pin_operators (branch_id, status, full_name);

create table public.branch_pin_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  shared_account_id uuid not null references public.branch_shared_accounts(id) on delete cascade,
  pin_operator_id uuid not null references public.branch_pin_operators(id) on delete cascade,
  token_hash bytea not null unique,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index branch_pin_sessions_account_active_idx
  on public.branch_pin_sessions (shared_account_id, revoked_at, last_seen_at desc);

alter table public.customers
  add column created_by_pin_operator_id uuid
  references public.branch_pin_operators(id) on delete set null;

alter table public.purchases
  add column pin_operator_id uuid
  references public.branch_pin_operators(id) on delete set null;

alter table public.stamp_ledger
  add column created_by_pin_operator_id uuid
  references public.branch_pin_operators(id) on delete set null;

alter table public.reward_redemptions
  add column pin_operator_id uuid
  references public.branch_pin_operators(id) on delete set null;

alter table public.audit_logs
  add column actor_pin_operator_id uuid
  references public.branch_pin_operators(id) on delete set null;

create trigger branch_shared_accounts_set_updated_at
  before update on public.branch_shared_accounts
  for each row execute function app.set_updated_at();

create trigger branch_pin_operators_set_updated_at
  before update on public.branch_pin_operators
  for each row execute function app.set_updated_at();

create or replace function app.enforce_branch_pin_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  branch_tenant_id uuid;
  staff_tenant_id uuid;
  operator_record record;
  account_record record;
begin
  select tenant_id into branch_tenant_id
  from public.branches
  where id = new.branch_id;

  if branch_tenant_id is distinct from new.tenant_id then
    raise exception 'PIN record tenant must match branch' using errcode = '23514';
  end if;

  if tg_table_name = 'branch_shared_accounts' then
    select tenant_id into staff_tenant_id
    from public.staff_profiles
    where id = new.staff_profile_id
      and role = 'EMPLOYEE'
      and account_kind = 'BRANCH_SHARED';

    if staff_tenant_id is distinct from new.tenant_id then
      raise exception 'shared account tenant must match branch' using errcode = '23514';
    end if;
  elsif tg_table_name = 'branch_pin_sessions' then
    select tenant_id, branch_id into operator_record
    from public.branch_pin_operators
    where id = new.pin_operator_id;

    select tenant_id, branch_id into account_record
    from public.branch_shared_accounts
    where id = new.shared_account_id;

    if operator_record.tenant_id is distinct from new.tenant_id
      or operator_record.branch_id is distinct from new.branch_id
      or account_record.tenant_id is distinct from new.tenant_id
      or account_record.branch_id is distinct from new.branch_id then
      raise exception 'PIN session scope is inconsistent' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger branch_shared_accounts_enforce_tenant
  before insert or update on public.branch_shared_accounts
  for each row execute function app.enforce_branch_pin_tenant_consistency();

create trigger branch_pin_operators_enforce_tenant
  before insert or update on public.branch_pin_operators
  for each row execute function app.enforce_branch_pin_tenant_consistency();

create trigger branch_pin_sessions_enforce_tenant
  before insert or update on public.branch_pin_sessions
  for each row execute function app.enforce_branch_pin_tenant_consistency();

create or replace function app.enforce_shared_account_branch_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if exists (
    select 1
    from public.staff_profiles sp
    where sp.id = new.staff_profile_id
      and sp.account_kind = 'BRANCH_SHARED'
  ) and not exists (
    select 1
    from public.branch_shared_accounts bsa
    where bsa.staff_profile_id = new.staff_profile_id
      and bsa.branch_id = new.branch_id
  ) then
    raise exception 'shared accounts can only be assigned to their configured branch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger staff_branch_assignments_enforce_shared_branch
  before insert or update on public.staff_branch_assignments
  for each row execute function app.enforce_shared_account_branch_assignment();

create or replace function app.request_pin_session_token()
returns text
language sql
stable
as $$
  select nullif(
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
      ->> 'x-swiftwallet-operator-session',
    ''
  );
$$;

create or replace function app.current_staff_is_shared_account()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(sp.account_kind = 'BRANCH_SHARED', false)
  from public.staff_profiles sp
  where sp.id = auth.uid();
$$;

create or replace function app.current_pin_session()
returns table (
  session_id uuid,
  tenant_id uuid,
  branch_id uuid,
  pin_operator_id uuid,
  operator_name text
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    bps.id,
    bps.tenant_id,
    bps.branch_id,
    bps.pin_operator_id,
    bpo.full_name
  from public.branch_pin_sessions bps
  join public.branch_shared_accounts bsa
    on bsa.id = bps.shared_account_id
    and bsa.staff_profile_id = auth.uid()
    and bsa.active
  join public.branch_pin_operators bpo
    on bpo.id = bps.pin_operator_id
    and bpo.status = 'ACTIVE'
  join public.branches b
    on b.id = bps.branch_id
    and b.status = 'ACTIVE'
    and b.employee_access_mode = 'SHARED_ACCOUNT_PIN'
  join public.tenants t
    on t.id = bps.tenant_id
    and t.status = 'ACTIVE'
  join public.staff_profiles sp
    on sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.account_kind = 'BRANCH_SHARED'
  where bps.revoked_at is null
    and bps.last_seen_at > now() - interval '8 hours'
    and bps.token_hash = extensions.digest(app.request_pin_session_token(), 'sha256')
  limit 1;
$$;

create or replace function app.current_pin_operator_id()
returns uuid
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select cps.pin_operator_id
  from app.current_pin_session() cps
  limit 1;
$$;

create or replace function app.current_staff_can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select app.is_superadmin()
    or exists (
      select 1
      from public.branches b
      join public.staff_profiles sp on sp.id = auth.uid()
      where b.id = target_branch_id
        and b.status = 'ACTIVE'
        and sp.status = 'ACTIVE'
        and app.current_tenant_is_active()
        and b.tenant_id = sp.tenant_id
        and (
          sp.role = 'ADMIN'
          or (
            sp.role = 'MANAGER'
            and exists (
              select 1 from public.staff_branch_assignments sba
              where sba.branch_id = b.id and sba.staff_profile_id = sp.id
            )
          )
          or (
            sp.role = 'EMPLOYEE'
            and sp.account_kind = 'INDIVIDUAL'
            and b.employee_access_mode = 'INDIVIDUAL_CREDENTIALS'
            and exists (
              select 1 from public.staff_branch_assignments sba
              where sba.branch_id = b.id and sba.staff_profile_id = sp.id
            )
          )
          or (
            sp.role = 'EMPLOYEE'
            and sp.account_kind = 'BRANCH_SHARED'
            and b.employee_access_mode = 'SHARED_ACCOUNT_PIN'
            and exists (
              select 1
              from public.branch_shared_accounts bsa
              join app.current_pin_session() cps
                on cps.branch_id = bsa.branch_id
              where bsa.branch_id = b.id
                and bsa.staff_profile_id = sp.id
                and bsa.active
            )
          )
        )
    );
$$;

create or replace function app.configure_branch_shared_access(
  target_branch_id uuid,
  target_staff_profile_id uuid,
  target_email text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  tenant_id_value uuid;
  branch_name_value text;
  prior_staff_id uuid;
begin
  if not app.current_staff_is_active()
    or not app.current_tenant_is_active()
    or app.current_staff_role() <> 'ADMIN'
    or target_staff_profile_id is null
    or nullif(lower(btrim(target_email)), '') is null then
    return 'UNAVAILABLE';
  end if;

  select b.tenant_id, b.name
    into tenant_id_value, branch_name_value
  from public.branches b
  where b.id = target_branch_id
    and b.tenant_id = app.current_staff_tenant_id()
    and b.status = 'ACTIVE'
  for update;

  if tenant_id_value is null then
    return 'UNAVAILABLE';
  end if;

  select staff_profile_id into prior_staff_id
  from public.branch_shared_accounts
  where branch_id = target_branch_id
  for update;

  if prior_staff_id is not null and prior_staff_id <> target_staff_profile_id then
    update public.staff_profiles
    set status = 'INACTIVE'
    where id = prior_staff_id;
  end if;

  insert into public.staff_profiles (
    id, tenant_id, email, full_name, role, status, account_kind, created_by
  ) values (
    target_staff_profile_id,
    tenant_id_value,
    lower(btrim(target_email)),
    'Acceso compartido · ' || branch_name_value,
    'EMPLOYEE',
    'ACTIVE',
    'BRANCH_SHARED',
    auth.uid()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      status = 'ACTIVE',
      account_kind = 'BRANCH_SHARED',
      updated_at = now();

  insert into public.branch_shared_accounts (
    tenant_id, branch_id, staff_profile_id, active, created_by_staff_id
  ) values (
    tenant_id_value, target_branch_id, target_staff_profile_id, true, auth.uid()
  )
  on conflict (branch_id) do update
  set staff_profile_id = excluded.staff_profile_id,
      active = true,
      failed_pin_attempts = 0,
      pin_locked_until = null,
      updated_at = now();

  insert into public.staff_branch_assignments (
    tenant_id, staff_profile_id, branch_id, is_primary, created_by
  ) values (
    tenant_id_value, target_staff_profile_id, target_branch_id, true, auth.uid()
  )
  on conflict (staff_profile_id, branch_id) do update
  set is_primary = true;

  update public.branches
  set employee_access_mode = 'SHARED_ACCOUNT_PIN'
  where id = target_branch_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    tenant_id_value,
    auth.uid(),
    'BRANCH_PIN_ACCESS_ENABLED',
    'branches',
    target_branch_id,
    jsonb_build_object('employee_access_mode', 'SHARED_ACCOUNT_PIN')
  );

  return 'CONFIGURED';
exception
  when unique_violation or check_violation then
    return 'INVALID';
end;
$$;

create or replace function app.disable_branch_shared_access(target_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  account_record record;
begin
  if not app.current_staff_is_active()
    or not app.current_tenant_is_active()
    or app.current_staff_role() <> 'ADMIN' then
    return 'UNAVAILABLE';
  end if;

  select bsa.* into account_record
  from public.branch_shared_accounts bsa
  where bsa.branch_id = target_branch_id
    and bsa.tenant_id = app.current_staff_tenant_id()
  for update;

  if not found then
    update public.branches
    set employee_access_mode = 'INDIVIDUAL_CREDENTIALS'
    where id = target_branch_id
      and tenant_id = app.current_staff_tenant_id();
    return case when found then 'DISABLED' else 'UNAVAILABLE' end;
  end if;

  update public.branch_shared_accounts
  set active = false,
      failed_pin_attempts = 0,
      pin_locked_until = null
  where id = account_record.id;

  update public.branch_pin_sessions
  set revoked_at = now()
  where shared_account_id = account_record.id
    and revoked_at is null;

  update public.staff_profiles
  set status = 'INACTIVE'
  where id = account_record.staff_profile_id;

  update public.branches
  set employee_access_mode = 'INDIVIDUAL_CREDENTIALS'
  where id = target_branch_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    account_record.tenant_id,
    auth.uid(),
    'BRANCH_PIN_ACCESS_DISABLED',
    'branches',
    target_branch_id,
    jsonb_build_object('employee_access_mode', 'INDIVIDUAL_CREDENTIALS')
  );

  return 'DISABLED';
end;
$$;

create or replace function app.current_staff_can_manage_branch_people(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(
    app.current_staff_is_active()
    and app.current_tenant_is_active()
    and (
      app.current_staff_role() = 'ADMIN'
      or (
        app.current_staff_role() = 'MANAGER'
        and exists (
          select 1 from public.staff_branch_assignments sba
          where sba.staff_profile_id = auth.uid()
            and sba.branch_id = target_branch_id
        )
      )
    ),
    false
  );
$$;

drop policy if exists staff_profiles_tenant_staff_select on public.staff_profiles;
create policy staff_profiles_tenant_staff_select
  on public.staff_profiles
  for select
  to authenticated
  using (
    tenant_id = app.current_staff_tenant_id()
    and app.current_staff_is_active()
    and app.current_tenant_is_active()
    and (
      app.current_staff_role() = 'ADMIN'
      or (
        app.current_staff_role() = 'MANAGER'
        and (
          id = auth.uid()
          or (
            role = 'EMPLOYEE'
            and exists (
              select 1
              from public.staff_branch_assignments target_assignment
              join public.staff_branch_assignments manager_assignment
                on manager_assignment.branch_id = target_assignment.branch_id
                and manager_assignment.staff_profile_id = auth.uid()
              where target_assignment.staff_profile_id = staff_profiles.id
            )
          )
        )
      )
    )
  );

create or replace function app.provision_branch_employee(
  target_staff_profile_id uuid,
  target_branch_id uuid,
  target_email text,
  target_full_name text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  tenant_id_value uuid;
begin
  if target_staff_profile_id is null
    or nullif(lower(btrim(target_email)), '') is null
    or nullif(btrim(target_full_name), '') is null
    or not app.current_staff_can_manage_branch_people(target_branch_id) then
    return 'INVALID';
  end if;

  select tenant_id into tenant_id_value
  from public.branches
  where id = target_branch_id
    and status = 'ACTIVE'
    and employee_access_mode = 'INDIVIDUAL_CREDENTIALS';

  if tenant_id_value is null or tenant_id_value is distinct from app.current_staff_tenant_id() then
    return 'UNAVAILABLE';
  end if;

  insert into public.staff_profiles (
    id, tenant_id, email, full_name, role, status, account_kind, created_by
  ) values (
    target_staff_profile_id,
    tenant_id_value,
    lower(btrim(target_email)),
    btrim(target_full_name),
    'EMPLOYEE',
    'PASSWORD_RESET_REQUIRED',
    'INDIVIDUAL',
    auth.uid()
  );

  insert into public.staff_branch_assignments (
    tenant_id, staff_profile_id, branch_id, is_primary, created_by
  ) values (
    tenant_id_value,
    target_staff_profile_id,
    target_branch_id,
    true,
    auth.uid()
  );

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    tenant_id_value,
    auth.uid(),
    'BRANCH_EMPLOYEE_CREATED',
    'staff_profiles',
    target_staff_profile_id,
    jsonb_build_object('branch_id', target_branch_id)
  );

  return 'CREATED';
exception
  when unique_violation or check_violation then
    return 'INVALID';
end;
$$;

create or replace function app.current_staff_can_manage_employee_account(
  target_staff_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(
    target.role = 'EMPLOYEE'
    and target.account_kind = 'INDIVIDUAL'
    and target.tenant_id = app.current_staff_tenant_id()
    and app.current_staff_is_active()
    and app.current_tenant_is_active()
    and (
      app.current_staff_role() = 'ADMIN'
      or (
        app.current_staff_role() = 'MANAGER'
        and exists (
          select 1 from public.staff_branch_assignments own_assignment
          where own_assignment.staff_profile_id = target_staff_profile_id
        )
        and not exists (
          select 1
          from public.staff_branch_assignments target_assignment
          where target_assignment.staff_profile_id = target_staff_profile_id
            and not exists (
              select 1
              from public.staff_branch_assignments manager_assignment
              where manager_assignment.staff_profile_id = auth.uid()
                and manager_assignment.branch_id = target_assignment.branch_id
            )
        )
      )
    ),
    false
  )
  from public.staff_profiles target
  where target.id = target_staff_profile_id;
$$;

create or replace function app.set_scoped_employee_status(
  target_staff_profile_id uuid,
  target_status public.staff_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if target_status not in ('ACTIVE', 'INACTIVE')
    or not app.current_staff_can_manage_employee_account(target_staff_profile_id) then
    return 'UNAVAILABLE';
  end if;

  update public.staff_profiles
  set status = target_status
  where id = target_staff_profile_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  )
  select tenant_id, auth.uid(), 'BRANCH_EMPLOYEE_STATUS_CHANGED',
    'staff_profiles', id, jsonb_build_object('status', target_status)
  from public.staff_profiles
  where id = target_staff_profile_id;

  return 'UPDATED';
end;
$$;

create or replace function app.assign_scoped_employee_branch(
  target_staff_profile_id uuid,
  target_branch_id uuid,
  make_primary boolean
)
returns text
language plpgsql
security definer
set search_path = public, app, auth
as $$
declare
  tenant_id_value uuid;
  has_assignments boolean;
begin
  if app.current_staff_role() <> 'MANAGER'
    or not app.current_staff_can_manage_employee_account(target_staff_profile_id)
    or not app.current_staff_can_manage_branch_people(target_branch_id) then
    return 'UNAVAILABLE';
  end if;

  select tenant_id into tenant_id_value
  from public.branches
  where id = target_branch_id
    and status = 'ACTIVE'
    and employee_access_mode = 'INDIVIDUAL_CREDENTIALS';

  if tenant_id_value is distinct from app.current_staff_tenant_id() then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:staff-branches:' || target_staff_profile_id::text, 0)
  );

  select exists (
    select 1 from public.staff_branch_assignments
    where staff_profile_id = target_staff_profile_id
  ) into has_assignments;

  if make_primary or not has_assignments then
    update public.staff_branch_assignments
    set is_primary = false
    where staff_profile_id = target_staff_profile_id;
  end if;

  insert into public.staff_branch_assignments (
    tenant_id, staff_profile_id, branch_id, is_primary, created_by
  ) values (
    tenant_id_value,
    target_staff_profile_id,
    target_branch_id,
    make_primary or not has_assignments,
    auth.uid()
  )
  on conflict (staff_profile_id, branch_id) do update
  set is_primary = excluded.is_primary;

  return 'ASSIGNED';
end;
$$;

create or replace function app.mark_scoped_employee_password_reset(
  target_staff_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if not app.current_staff_can_manage_employee_account(target_staff_profile_id) then
    return 'UNAVAILABLE';
  end if;

  update public.staff_profiles
  set status = 'PASSWORD_RESET_REQUIRED',
      temporary_password_expires_at = now() + interval '24 hours'
  where id = target_staff_profile_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  )
  select tenant_id, auth.uid(), 'BRANCH_EMPLOYEE_PASSWORD_RESET',
    'staff_profiles', id, '{}'::jsonb
  from public.staff_profiles
  where id = target_staff_profile_id;

  return 'UPDATED';
end;
$$;

create or replace function app.list_branch_pin_operators(target_branch_id uuid)
returns table (id uuid, full_name text, status public.pin_operator_status, created_at timestamptz)
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select bpo.id, bpo.full_name, bpo.status, bpo.created_at
  from public.branch_pin_operators bpo
  where bpo.branch_id = target_branch_id
    and app.current_staff_can_manage_branch_people(target_branch_id)
  order by bpo.full_name;
$$;

create or replace function app.create_branch_pin_operator(
  target_branch_id uuid,
  target_full_name text,
  target_pin text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  tenant_id_value uuid;
begin
  if not app.current_staff_can_manage_branch_people(target_branch_id)
    or nullif(btrim(target_full_name), '') is null
    or target_pin !~ '^[0-9]{6}$' then
    return 'INVALID';
  end if;

  select tenant_id into tenant_id_value
  from public.branches
  where id = target_branch_id
    and status = 'ACTIVE'
    and employee_access_mode = 'SHARED_ACCOUNT_PIN';

  if tenant_id_value is null or tenant_id_value is distinct from app.current_staff_tenant_id() then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:branch-pins:' || target_branch_id::text, 0)
  );

  if exists (
    select 1 from public.branch_pin_operators bpo
    where bpo.branch_id = target_branch_id
      and extensions.crypt(target_pin, bpo.pin_hash) = bpo.pin_hash
  ) then
    return 'DUPLICATE_PIN';
  end if;

  insert into public.branch_pin_operators (
    tenant_id, branch_id, full_name, pin_hash, created_by_staff_id
  ) values (
    tenant_id_value,
    target_branch_id,
    btrim(target_full_name),
    extensions.crypt(target_pin, extensions.gen_salt('bf', 10)),
    auth.uid()
  );

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  )
  select tenant_id_value, auth.uid(), 'PIN_OPERATOR_CREATED', 'branch_pin_operators', id,
    jsonb_build_object('branch_id', target_branch_id, 'full_name', full_name)
  from public.branch_pin_operators
  where branch_id = target_branch_id and full_name = btrim(target_full_name)
  order by created_at desc limit 1;

  return 'CREATED';
end;
$$;

create or replace function app.reset_branch_pin_operator(
  target_operator_id uuid,
  target_pin text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  operator_record record;
begin
  select * into operator_record
  from public.branch_pin_operators
  where id = target_operator_id
  for update;

  if operator_record.id is null
    or not app.current_staff_can_manage_branch_people(operator_record.branch_id)
    or target_pin !~ '^[0-9]{6}$' then
    return 'INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:branch-pins:' || operator_record.branch_id::text, 0)
  );

  if exists (
    select 1 from public.branch_pin_operators bpo
    where bpo.branch_id = operator_record.branch_id
      and bpo.id <> target_operator_id
      and extensions.crypt(target_pin, bpo.pin_hash) = bpo.pin_hash
  ) then
    return 'DUPLICATE_PIN';
  end if;

  update public.branch_pin_operators
  set pin_hash = extensions.crypt(target_pin, extensions.gen_salt('bf', 10)),
      status = 'ACTIVE'
  where id = target_operator_id;

  update public.branch_pin_sessions
  set revoked_at = now()
  where pin_operator_id = target_operator_id and revoked_at is null;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    operator_record.tenant_id, auth.uid(), 'PIN_OPERATOR_PIN_RESET',
    'branch_pin_operators', target_operator_id,
    jsonb_build_object('branch_id', operator_record.branch_id)
  );

  return 'RESET';
end;
$$;

create or replace function app.set_branch_pin_operator_status(
  target_operator_id uuid,
  target_status public.pin_operator_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  operator_record record;
begin
  select * into operator_record
  from public.branch_pin_operators
  where id = target_operator_id
  for update;

  if operator_record.id is null
    or not app.current_staff_can_manage_branch_people(operator_record.branch_id) then
    return 'UNAVAILABLE';
  end if;

  update public.branch_pin_operators
  set status = target_status
  where id = target_operator_id;

  if target_status = 'INACTIVE' then
    update public.branch_pin_sessions
    set revoked_at = now()
    where pin_operator_id = target_operator_id and revoked_at is null;
  end if;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    operator_record.tenant_id, auth.uid(), 'PIN_OPERATOR_STATUS_CHANGED',
    'branch_pin_operators', target_operator_id,
    jsonb_build_object('branch_id', operator_record.branch_id, 'status', target_status)
  );

  return 'UPDATED';
end;
$$;

create or replace function app.clear_branch_pin_lockout(target_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if not app.current_staff_can_manage_branch_people(target_branch_id) then
    return 'UNAVAILABLE';
  end if;

  update public.branch_shared_accounts
  set failed_pin_attempts = 0, pin_locked_until = null
  where branch_id = target_branch_id;

  return case when found then 'CLEARED' else 'UNAVAILABLE' end;
end;
$$;

create or replace function app.unlock_branch_pin(target_pin text)
returns table (
  result text,
  session_token text,
  operator_name text,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  account_record record;
  operator_record record;
  token_value text;
  next_attempts integer;
begin
  select bsa.*, b.name as branch_name
    into account_record
  from public.branch_shared_accounts bsa
  join public.branches b
    on b.id = bsa.branch_id
    and b.status = 'ACTIVE'
    and b.employee_access_mode = 'SHARED_ACCOUNT_PIN'
  join public.tenants t
    on t.id = bsa.tenant_id and t.status = 'ACTIVE'
  join public.staff_profiles sp
    on sp.id = bsa.staff_profile_id
    and sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.account_kind = 'BRANCH_SHARED'
  where bsa.active
  for update of bsa;

  if not found then
    return query select 'UNAVAILABLE', null::text, null::text, null::timestamptz;
    return;
  end if;

  if account_record.pin_locked_until is not null
    and account_record.pin_locked_until > now() then
    return query select 'LOCKED', null::text, null::text, account_record.pin_locked_until;
    return;
  end if;

  if account_record.pin_locked_until is not null then
    update public.branch_shared_accounts
    set failed_pin_attempts = 0, pin_locked_until = null
    where id = account_record.id;
    account_record.failed_pin_attempts := 0;
  end if;

  if target_pin ~ '^[0-9]{6}$' then
    select bpo.* into operator_record
    from public.branch_pin_operators bpo
    where bpo.branch_id = account_record.branch_id
      and bpo.status = 'ACTIVE'
      and extensions.crypt(target_pin, bpo.pin_hash) = bpo.pin_hash
    limit 1;
  end if;

  if operator_record.id is null then
    next_attempts := account_record.failed_pin_attempts + 1;
    update public.branch_shared_accounts
    set failed_pin_attempts = next_attempts,
        pin_locked_until = case when next_attempts >= 5 then now() + interval '5 minutes' else null end
    where id = account_record.id;

    insert into public.audit_logs (
      tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
    ) values (
      account_record.tenant_id,
      auth.uid(),
      'PIN_UNLOCK_FAILED',
      'branches',
      account_record.branch_id,
      jsonb_build_object('failed_attempts', next_attempts, 'locked', next_attempts >= 5)
    );

    return query select
      case when next_attempts >= 5 then 'LOCKED' else 'INVALID_PIN' end,
      null::text,
      null::text,
      case when next_attempts >= 5 then now() + interval '5 minutes' else null end;
    return;
  end if;

  update public.branch_shared_accounts
  set failed_pin_attempts = 0, pin_locked_until = null
  where id = account_record.id;

  token_value := replace(replace(rtrim(
    encode(extensions.gen_random_bytes(32), 'base64'), '='
  ), '+', '-'), '/', '_');

  insert into public.branch_pin_sessions (
    tenant_id, branch_id, shared_account_id, pin_operator_id, token_hash
  ) values (
    account_record.tenant_id,
    account_record.branch_id,
    account_record.id,
    operator_record.id,
    extensions.digest(token_value, 'sha256')
  );

  insert into public.audit_logs (
    tenant_id, actor_staff_id, actor_pin_operator_id,
    action, entity_type, entity_id, metadata
  ) values (
    account_record.tenant_id,
    auth.uid(),
    operator_record.id,
    'PIN_SESSION_STARTED',
    'branch_pin_operators',
    operator_record.id,
    jsonb_build_object('branch_id', account_record.branch_id)
  );

  return query select 'UNLOCKED', token_value, operator_record.full_name, null::timestamptz;
end;
$$;

create or replace function app.get_current_pin_operator()
returns table (id uuid, full_name text, branch_id uuid, branch_name text)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  session_record record;
begin
  select * into session_record from app.current_pin_session();

  if session_record.session_id is null then
    return;
  end if;

  update public.branch_pin_sessions
  set last_seen_at = now()
  where id = session_record.session_id;

  return query
  select session_record.pin_operator_id, session_record.operator_name,
    session_record.branch_id, b.name
  from public.branches b
  where b.id = session_record.branch_id;
end;
$$;

create or replace function app.revoke_current_pin_session()
returns boolean
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  update public.branch_pin_sessions bps
  set revoked_at = now()
  from public.branch_shared_accounts bsa
  where bps.shared_account_id = bsa.id
    and bsa.staff_profile_id = auth.uid()
    and bps.revoked_at is null
    and bps.token_hash = extensions.digest(app.request_pin_session_token(), 'sha256');

  return found;
end;
$$;

create or replace function app.attribute_pin_operator()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  operator_id_value uuid;
begin
  if app.current_staff_is_shared_account() then
    operator_id_value := app.current_pin_operator_id();
    if operator_id_value is null then
      raise exception 'an active PIN operator session is required' using errcode = '42501';
    end if;

    if tg_table_name = 'customers' then
      new.created_by_pin_operator_id := operator_id_value;
    elsif tg_table_name = 'purchases' then
      new.pin_operator_id := operator_id_value;
    elsif tg_table_name = 'stamp_ledger' then
      new.created_by_pin_operator_id := operator_id_value;
    elsif tg_table_name = 'reward_redemptions' then
      new.pin_operator_id := operator_id_value;
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_attribute_pin_operator
  before insert on public.customers
  for each row execute function app.attribute_pin_operator();

create trigger purchases_attribute_pin_operator
  before insert on public.purchases
  for each row execute function app.attribute_pin_operator();

create trigger stamp_ledger_attribute_pin_operator
  before insert on public.stamp_ledger
  for each row execute function app.attribute_pin_operator();

create trigger reward_redemptions_attribute_pin_operator
  before insert on public.reward_redemptions
  for each row execute function app.attribute_pin_operator();

create or replace function app.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  actor_pin_id uuid := app.current_pin_operator_id();
  tenant_value uuid;
  action_value text;
  entity_value uuid;
  metadata_value jsonb;
begin
  if tg_table_name = 'customers' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := case when tg_op = 'INSERT' then 'CUSTOMER_CREATED' else 'CUSTOMER_UPDATED' end;
    metadata_value := jsonb_build_object(
      'status', new.status,
      'registration_method', new.registration_method
    );
  elsif tg_table_name = 'purchases' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := case when tg_op = 'INSERT' then 'PURCHASE_CONFIRMED' else 'PURCHASE_CANCELLED' end;
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'amount_minor', new.amount_minor,
      'ticket_number', new.ticket_number,
      'reason', new.cancellation_reason
    );
  elsif tg_table_name = 'reward_redemptions' then
    tenant_value := new.tenant_id;
    entity_value := new.reward_id;
    action_value := case when tg_op = 'INSERT' then 'REWARD_REDEEMED' else 'REWARD_REDEMPTION_REVERSED' end;
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'redemption_id', new.id,
      'reason', new.reversal_reason
    );
  elsif tg_table_name = 'stamp_adjustments' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := 'STAMP_ADJUSTMENT';
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'stamps_delta', new.stamps_delta,
      'rewards_generated', new.rewards_generated,
      'reason', new.reason
    );
  elsif tg_table_name = 'rewards' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    if tg_op = 'INSERT' then
      action_value := 'REWARD_GENERATED';
      metadata_value := jsonb_build_object(
        'status', new.status,
        'source_purchase_id', new.source_purchase_id,
        'source_adjustment_id', new.source_adjustment_id,
        'expires_at', new.expires_at
      );
    else
      if old.status is not distinct from new.status then
        return new;
      end if;
      if new.status in ('REDEEMED', 'AVAILABLE') then
        return new;
      end if;
      action_value := case new.status
        when 'CANCELLED' then 'REWARD_CANCELLED'
        when 'EXPIRED' then 'REWARD_EXPIRED'
      end;
      metadata_value := jsonb_build_object(
        'previous_status', old.status,
        'status', new.status,
        'reason', new.cancellation_reason,
        'expires_at', new.expires_at
      );
    end if;
  elsif tg_table_name = 'loyalty_programs' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := 'LOYALTY_PROGRAM_UPDATED';
    metadata_value := jsonb_build_object(
      'previous_status', old.status,
      'status', new.status,
      'previous_rule_type', old.rule_type,
      'rule_type', new.rule_type,
      'previous_reward_stamp_goal', old.reward_stamp_goal,
      'reward_stamp_goal', new.reward_stamp_goal,
      'previous_version', old.version,
      'version', new.version
    );
  else
    return new;
  end if;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    actor_pin_operator_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    tenant_value,
    actor_id,
    actor_pin_id,
    action_value,
    tg_table_name,
    entity_value,
    metadata_value
  );
  return new;
end;
$$;

create or replace function app.resolve_staff_card_scan(target_card_token text)
returns table (result text, customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  card_record record;
begin
  select sp.tenant_id into staff_tenant_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE'
    and (
      (
        sp.account_kind = 'INDIVIDUAL'
        and (
          sp.role = 'MANAGER'
          or exists (
            select 1 from public.staff_branch_assignments sba
            where sba.staff_profile_id = sp.id
              and app.current_staff_can_access_branch(sba.branch_id)
          )
        )
      )
      or app.current_pin_operator_id() is not null
    );

  if staff_tenant_id is null then
    return query select 'UNAVAILABLE', null::uuid, null::text;
    return;
  end if;

  select cc.tenant_id, cc.customer_id, c.full_name into card_record
  from public.customer_cards cc
  join public.customers c on c.id = cc.customer_id
  where cc.public_token = target_card_token
    and cc.status = 'ACTIVE'
    and c.status = 'ACTIVE';

  if not found or card_record.tenant_id is distinct from staff_tenant_id then
    return query select 'NOT_THIS_TENANT', null::uuid, null::text;
    return;
  end if;

  return query select 'FOUND', card_record.customer_id, card_record.full_name;
end;
$$;

create or replace function app.expire_due_rewards()
returns integer
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  expired_count integer;
begin
  select sp.tenant_id into staff_tenant_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE'
    and (
      (
        sp.account_kind = 'INDIVIDUAL'
        and (
          sp.role = 'MANAGER'
          or exists (
            select 1 from public.staff_branch_assignments sba
            where sba.staff_profile_id = sp.id
              and app.current_staff_can_access_branch(sba.branch_id)
          )
        )
      )
      or app.current_pin_operator_id() is not null
    );

  if staff_tenant_id is null then
    return 0;
  end if;

  update public.rewards
  set status = 'EXPIRED'
  where tenant_id = staff_tenant_id
    and status = 'AVAILABLE'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

alter table public.branch_shared_accounts enable row level security;
alter table public.branch_shared_accounts force row level security;
alter table public.branch_pin_operators enable row level security;
alter table public.branch_pin_operators force row level security;
alter table public.branch_pin_sessions enable row level security;
alter table public.branch_pin_sessions force row level security;

revoke all on public.branch_shared_accounts from authenticated, anon;
revoke all on public.branch_pin_operators from authenticated, anon;
revoke all on public.branch_pin_sessions from authenticated, anon;

revoke all on function app.configure_branch_shared_access(uuid, uuid, text) from public, anon;
revoke all on function app.disable_branch_shared_access(uuid) from public, anon;
revoke all on function app.list_branch_pin_operators(uuid) from public, anon;
revoke all on function app.create_branch_pin_operator(uuid, text, text) from public, anon;
revoke all on function app.reset_branch_pin_operator(uuid, text) from public, anon;
revoke all on function app.set_branch_pin_operator_status(uuid, public.pin_operator_status) from public, anon;
revoke all on function app.clear_branch_pin_lockout(uuid) from public, anon;
revoke all on function app.unlock_branch_pin(text) from public, anon;
revoke all on function app.get_current_pin_operator() from public, anon;
revoke all on function app.revoke_current_pin_session() from public, anon;
revoke all on function app.provision_branch_employee(uuid, uuid, text, text) from public, anon;
revoke all on function app.current_staff_can_manage_employee_account(uuid) from public, anon;
revoke all on function app.set_scoped_employee_status(uuid, public.staff_status) from public, anon;
revoke all on function app.assign_scoped_employee_branch(uuid, uuid, boolean) from public, anon;
revoke all on function app.mark_scoped_employee_password_reset(uuid) from public, anon;

grant execute on function app.configure_branch_shared_access(uuid, uuid, text) to authenticated;
grant execute on function app.disable_branch_shared_access(uuid) to authenticated;
grant execute on function app.list_branch_pin_operators(uuid) to authenticated;
grant execute on function app.create_branch_pin_operator(uuid, text, text) to authenticated;
grant execute on function app.reset_branch_pin_operator(uuid, text) to authenticated;
grant execute on function app.set_branch_pin_operator_status(uuid, public.pin_operator_status) to authenticated;
grant execute on function app.clear_branch_pin_lockout(uuid) to authenticated;
grant execute on function app.unlock_branch_pin(text) to authenticated;
grant execute on function app.get_current_pin_operator() to authenticated;
grant execute on function app.revoke_current_pin_session() to authenticated;
grant execute on function app.provision_branch_employee(uuid, uuid, text, text) to authenticated;
grant execute on function app.current_staff_can_manage_employee_account(uuid) to authenticated;
grant execute on function app.set_scoped_employee_status(uuid, public.staff_status) to authenticated;
grant execute on function app.assign_scoped_employee_branch(uuid, uuid, boolean) to authenticated;
grant execute on function app.mark_scoped_employee_password_reset(uuid) to authenticated;

revoke all on function app.request_pin_session_token() from public, anon;
revoke all on function app.current_staff_is_shared_account() from public, anon;
revoke all on function app.current_pin_session() from public, anon;
revoke all on function app.current_pin_operator_id() from public, anon;
revoke all on function app.current_staff_can_manage_branch_people(uuid) from public, anon;
grant execute on function app.request_pin_session_token() to authenticated;
grant execute on function app.current_staff_is_shared_account() to authenticated;
grant execute on function app.current_pin_session() to authenticated;
grant execute on function app.current_pin_operator_id() to authenticated;
grant execute on function app.current_staff_can_manage_branch_people(uuid) to authenticated;
