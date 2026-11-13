-- DEC-0072: tenant modules by plan with Superadmin overrides.
--
-- A module is active for a tenant when (in order):
--   1. its global mode is not OFF (a missing row means OFF: modules are born off);
--   2. the tenant is not REVOKED;
--   3. the tenant is GRANTED (and the grant has not expired)          -> active;
--   4. the global mode is BETA                                         -> inactive;
--   5. an ACTIVE/TRIALING, not ended subscription lists the module in
--      entitlements_snapshot.modules                                   -> active.
-- A switch ("module.part") is active when its parent module is active, its
-- own global mode is not OFF (a missing row means ON) and the tenant is not
-- REVOKED for it.
--
-- This migration does not change any existing function or behavior.

create type public.module_global_mode as enum ('OFF', 'BETA', 'ON');
create type public.tenant_module_state as enum ('GRANTED', 'REVOKED');

create function app.module_key_is_valid(target_key text)
returns boolean
language sql
immutable
as $$
  select coalesce(target_key ~ '^[a-z][a-z0-9_]{1,48}(\.[a-z][a-z0-9_]{1,48})?$', false);
$$;

create table public.module_states (
  module_key text primary key,
  mode public.module_global_mode not null,
  reason text not null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint module_states_key_valid check (app.module_key_is_valid(module_key)),
  constraint module_states_reason_length check (length(btrim(reason)) between 3 and 500)
);

create table public.tenant_module_overrides (
  module_key text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  state public.tenant_module_state not null,
  expires_at timestamptz,
  reason text not null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (module_key, tenant_id),
  constraint tenant_module_overrides_key_valid check (app.module_key_is_valid(module_key)),
  constraint tenant_module_overrides_expiry_only_granted check (expires_at is null or state = 'GRANTED'),
  constraint tenant_module_overrides_reason_length check (length(btrim(reason)) between 3 and 500)
);

create index tenant_module_overrides_tenant_idx on public.tenant_module_overrides (tenant_id);

alter table public.module_states enable row level security;
alter table public.module_states force row level security;
alter table public.tenant_module_overrides enable row level security;
alter table public.tenant_module_overrides force row level security;

create policy module_states_superadmin_read on public.module_states
  for select to authenticated using (app.is_superadmin());
create policy tenant_module_overrides_superadmin_read on public.tenant_module_overrides
  for select to authenticated using (app.is_superadmin());

revoke all on public.module_states, public.tenant_module_overrides from public, anon, authenticated;
grant select on public.module_states, public.tenant_module_overrides to authenticated;

-- Whether a current subscription of the tenant includes the module.
create function app.module_plan_includes(target_key text, target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select exists (
    select 1
    from public.tenant_subscriptions s
    where s.tenant_id = target_tenant_id
      and s.ended_at is null
      and s.status in ('ACTIVE', 'TRIALING')
      and jsonb_typeof(s.entitlements_snapshot -> 'modules') = 'array'
      and (s.entitlements_snapshot -> 'modules') ? target_key
  );
$$;

create function app.tenant_has_module(target_key text, target_tenant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  global_mode public.module_global_mode;
  override_state public.tenant_module_state;
  override_expires_at timestamptz;
begin
  if target_tenant_id is null or not app.module_key_is_valid(target_key) then
    return false;
  end if;

  select ms.mode into global_mode
  from public.module_states ms
  where ms.module_key = target_key;

  select o.state, o.expires_at into override_state, override_expires_at
  from public.tenant_module_overrides o
  where o.module_key = target_key and o.tenant_id = target_tenant_id;

  if position('.' in target_key) > 0 then
    return app.tenant_has_module(split_part(target_key, '.', 1), target_tenant_id)
      and coalesce(global_mode, 'ON') <> 'OFF'
      and override_state is distinct from 'REVOKED';
  end if;

  if coalesce(global_mode, 'OFF') = 'OFF' or override_state = 'REVOKED' then
    return false;
  end if;
  if override_state = 'GRANTED'
    and (override_expires_at is null or override_expires_at > now()) then
    return true;
  end if;
  if global_mode = 'BETA' then
    return false;
  end if;
  return app.module_plan_includes(target_key, target_tenant_id);
end;
$$;

-- The caller's own tenant, or the supported tenant in support mode (DEC-0071).
create function app.current_tenant_has_module(
  target_key text,
  target_support_token_hash text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  return coalesce(app.tenant_has_module(
    target_key, coalesce(app.current_staff_tenant_id(), app.support_session_tenant())
  ), false);
end;
$$;

create function app.require_module_reason(target_reason text)
returns text
language plpgsql
immutable
as $$
begin
  if target_reason is null or length(btrim(target_reason)) not between 3 and 500 then
    return null;
  end if;
  return btrim(target_reason);
end;
$$;

create function app.set_module_global(
  target_key text,
  target_mode public.module_global_mode,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  previous_mode public.module_global_mode;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if not app.module_key_is_valid(target_key) or target_mode is null or clean_reason is null then
    return 'INVALID';
  end if;

  select ms.mode into previous_mode
  from public.module_states ms
  where ms.module_key = target_key
  for update;

  insert into public.module_states (module_key, mode, reason, updated_by_staff_id, updated_at)
  values (target_key, target_mode, clean_reason, auth.uid(), now())
  on conflict (module_key) do update
    set mode = excluded.mode, reason = excluded.reason,
        updated_by_staff_id = excluded.updated_by_staff_id, updated_at = excluded.updated_at;

  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'MODULE_GLOBAL_UPDATED', 'modules', null,
          jsonb_build_object('module', target_key, 'from', previous_mode,
                             'to', target_mode, 'reason', clean_reason));
  return 'UPDATED';
end;
$$;

-- target_state: 'INHERIT' (removes the override), 'GRANTED' or 'REVOKED'.
create function app.set_tenant_module(
  target_key text,
  target_tenant_id uuid,
  target_state text,
  target_expires_at timestamptz,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  previous_state public.tenant_module_state;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if not app.module_key_is_valid(target_key) or clean_reason is null
    or target_state is null or target_state not in ('INHERIT', 'GRANTED', 'REVOKED')
    or (target_expires_at is not null and (target_state <> 'GRANTED' or target_expires_at <= now())) then
    return 'INVALID';
  end if;
  if not exists (select 1 from public.tenants t where t.id = target_tenant_id) then
    return 'NOT_FOUND';
  end if;

  select o.state into previous_state
  from public.tenant_module_overrides o
  where o.module_key = target_key and o.tenant_id = target_tenant_id
  for update;

  if target_state = 'INHERIT' then
    delete from public.tenant_module_overrides o
    where o.module_key = target_key and o.tenant_id = target_tenant_id;
  else
    insert into public.tenant_module_overrides (
      module_key, tenant_id, state, expires_at, reason, updated_by_staff_id, updated_at
    ) values (
      target_key, target_tenant_id, target_state::public.tenant_module_state,
      target_expires_at, clean_reason, auth.uid(), now()
    )
    on conflict (module_key, tenant_id) do update
      set state = excluded.state, expires_at = excluded.expires_at, reason = excluded.reason,
          updated_by_staff_id = excluded.updated_by_staff_id, updated_at = excluded.updated_at;
  end if;

  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), 'TENANT_MODULE_UPDATED', 'tenants', target_tenant_id,
          jsonb_build_object('module', target_key, 'from', coalesce(previous_state::text, 'INHERIT'),
                             'to', target_state, 'expires_at', target_expires_at,
                             'reason', clean_reason));
  return 'UPDATED';
end;
$$;

-- Overview for the Superadmin "Módulos" page. Keys come from the code catalog.
create function app.get_module_overview(target_keys text[])
returns table (
  module_key text,
  mode public.module_global_mode,
  reason text,
  updated_at timestamptz,
  plan_tenants bigint,
  granted_tenants bigint,
  revoked_tenants bigint,
  active_tenants bigint
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  return query
  select k.key,
    ms.mode,
    ms.reason,
    ms.updated_at,
    (select count(*) from public.tenants t where app.module_plan_includes(split_part(k.key, '.', 1), t.id)),
    (select count(*) from public.tenant_module_overrides o where o.module_key = k.key and o.state = 'GRANTED'
       and (o.expires_at is null or o.expires_at > now())),
    (select count(*) from public.tenant_module_overrides o where o.module_key = k.key and o.state = 'REVOKED'),
    (select count(*) from public.tenants t where app.tenant_has_module(k.key, t.id))
  from unnest(coalesce(target_keys, array[]::text[])) as k(key)
  left join public.module_states ms on ms.module_key = k.key
  where app.module_key_is_valid(k.key);
end;
$$;

-- Effective modules of one tenant, for the Superadmin tenant view.
create function app.get_tenant_modules(target_tenant_id uuid, target_keys text[])
returns table (
  module_key text,
  global_mode public.module_global_mode,
  override_state public.tenant_module_state,
  override_expires_at timestamptz,
  override_reason text,
  included_in_plan boolean,
  active boolean
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  return query
  select k.key,
    ms.mode,
    o.state,
    o.expires_at,
    o.reason,
    app.module_plan_includes(split_part(k.key, '.', 1), target_tenant_id),
    app.tenant_has_module(k.key, target_tenant_id)
  from unnest(coalesce(target_keys, array[]::text[])) as k(key)
  left join public.module_states ms on ms.module_key = k.key
  left join public.tenant_module_overrides o
    on o.module_key = k.key and o.tenant_id = target_tenant_id
  where app.module_key_is_valid(k.key);
end;
$$;

-- Every tenant's state for one module, for the Superadmin module detail.
create function app.get_module_tenants(target_key text)
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_status text,
  included_in_plan boolean,
  override_state public.tenant_module_state,
  override_expires_at timestamptz,
  override_reason text,
  active boolean
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  if not app.module_key_is_valid(target_key) then
    return;
  end if;
  return query
  select t.id, t.name, t.status::text,
    app.module_plan_includes(split_part(target_key, '.', 1), t.id),
    o.state, o.expires_at, o.reason,
    app.tenant_has_module(target_key, t.id)
  from public.tenants t
  left join public.tenant_module_overrides o
    on o.module_key = target_key and o.tenant_id = t.id
  order by lower(t.name), t.id;
end;
$$;

-- Sets the modules a package sells. Added modules also reach current
-- subscriptions of that package; removed modules only affect new
-- subscriptions, so nobody loses what they already paid for.
create function app.set_billing_package_modules(
  target_package_id uuid,
  target_modules text[],
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  clean_reason text := app.require_module_reason(target_reason);
  clean_modules text[];
  previous_modules text[];
  added_modules text[];
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct m order by m), array[]::text[]) into clean_modules
  from unnest(coalesce(target_modules, array[]::text[])) as m;
  if clean_reason is null or exists (
    select 1 from unnest(clean_modules) as m
    where not app.module_key_is_valid(m) or position('.' in m) > 0
  ) then
    return 'INVALID';
  end if;

  select coalesce(array(
    select jsonb_array_elements_text(
      case when jsonb_typeof(p.entitlements -> 'modules') = 'array'
        then p.entitlements -> 'modules' else '[]'::jsonb end)
  ), array[]::text[]) into previous_modules
  from public.billing_packages p
  where p.id = target_package_id
  for update;
  if not found then
    return 'NOT_FOUND';
  end if;

  update public.billing_packages
  set entitlements = entitlements || jsonb_build_object('modules', to_jsonb(clean_modules))
  where id = target_package_id;

  select coalesce(array_agg(m), array[]::text[]) into added_modules
  from unnest(clean_modules) as m
  where not (m = any (previous_modules));

  if cardinality(added_modules) > 0 then
    update public.tenant_subscriptions s
    set entitlements_snapshot = s.entitlements_snapshot || jsonb_build_object(
      'modules',
      (select to_jsonb(coalesce(array_agg(distinct m order by m), array[]::text[]))
       from unnest(
         coalesce(array(select jsonb_array_elements_text(
           case when jsonb_typeof(s.entitlements_snapshot -> 'modules') = 'array'
             then s.entitlements_snapshot -> 'modules' else '[]'::jsonb end)), array[]::text[])
         || added_modules) as m)
    )
    where s.package_id = target_package_id and s.ended_at is null;
  end if;

  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'BILLING_PACKAGE_MODULES_UPDATED', 'billing_packages', target_package_id,
          jsonb_build_object('from', to_jsonb(previous_modules), 'to', to_jsonb(clean_modules),
                             'reason', clean_reason));
  return 'UPDATED';
end;
$$;

revoke all on function app.module_key_is_valid(text) from public, anon;
revoke all on function app.module_plan_includes(text, uuid) from public, anon, authenticated;
revoke all on function app.tenant_has_module(text, uuid) from public, anon, authenticated;
revoke all on function app.current_tenant_has_module(text, text) from public, anon;
revoke all on function app.require_module_reason(text) from public, anon, authenticated;
revoke all on function app.set_module_global(text, public.module_global_mode, text) from public, anon;
revoke all on function app.set_tenant_module(text, uuid, text, timestamptz, text) from public, anon;
revoke all on function app.get_module_overview(text[]) from public, anon;
revoke all on function app.get_tenant_modules(uuid, text[]) from public, anon;
revoke all on function app.get_module_tenants(text) from public, anon;
revoke all on function app.set_billing_package_modules(uuid, text[], text) from public, anon;

grant execute on function app.module_key_is_valid(text) to authenticated;
grant execute on function app.tenant_has_module(text, uuid) to service_role;
grant execute on function app.current_tenant_has_module(text, text) to authenticated;
grant execute on function app.set_module_global(text, public.module_global_mode, text) to authenticated;
grant execute on function app.set_tenant_module(text, uuid, text, timestamptz, text) to authenticated;
grant execute on function app.get_module_overview(text[]) to authenticated;
grant execute on function app.get_tenant_modules(uuid, text[]) to authenticated;
grant execute on function app.get_module_tenants(text) to authenticated;
grant execute on function app.set_billing_package_modules(uuid, text[], text) to authenticated;
