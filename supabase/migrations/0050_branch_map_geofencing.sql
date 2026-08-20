-- Make location validation configurable by tenant Admin and safe to enable.
-- Existing tenants remain FLEXIBLE until their active branches have coordinates.

create or replace function app.validate_operation_location(
  target_tenant_id uuid,
  target_branch_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  tenant_mode public.location_validation_mode;
  branch_record record;
  haversine_term numeric;
  distance_meters numeric;
begin
  select t.location_validation_mode
    into tenant_mode
  from public.tenants t
  where t.id = target_tenant_id;

  if tenant_mode is null then return false; end if;
  if tenant_mode <> 'STRICT' then return true; end if;
  if target_latitude is null or target_longitude is null
    or target_latitude not between -90 and 90
    or target_longitude not between -180 and 180 then
    return false;
  end if;

  select b.latitude, b.longitude, b.geofence_radius_meters
    into branch_record
  from public.branches b
  where b.id = target_branch_id
    and b.tenant_id = target_tenant_id
    and b.status = 'ACTIVE';

  if branch_record.latitude is null or branch_record.longitude is null then
    return false;
  end if;

  haversine_term :=
    sin(radians((target_latitude - branch_record.latitude) / 2)) ^ 2
    + cos(radians(branch_record.latitude)) * cos(radians(target_latitude))
    * sin(radians((target_longitude - branch_record.longitude) / 2)) ^ 2;
  distance_meters := 6371000 * 2 * asin(sqrt(least(1::numeric, greatest(0::numeric, haversine_term))));
  return distance_meters <= branch_record.geofence_radius_meters;
end;
$$;

create or replace function app.enforce_strict_branch_coordinates()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  tenant_mode public.location_validation_mode;
begin
  if new.status <> 'ACTIVE' then return new; end if;
  select t.location_validation_mode into tenant_mode
  from public.tenants t where t.id = new.tenant_id;
  if tenant_mode = 'STRICT' and (new.latitude is null or new.longitude is null) then
    raise exception 'strict geofencing requires branch coordinates'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists branches_require_strict_coordinates on public.branches;
create trigger branches_require_strict_coordinates
  before insert or update of tenant_id, status, latitude, longitude on public.branches
  for each row execute function app.enforce_strict_branch_coordinates();

create or replace function app.set_tenant_location_validation_mode(
  target_mode public.location_validation_mode
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  previous_mode public.location_validation_mode;
begin
  select sp.id, sp.tenant_id, t.location_validation_mode
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if staff_record.id is null or staff_record.tenant_id is null or target_mode is null then
    return 'UNAVAILABLE';
  end if;
  previous_mode := staff_record.location_validation_mode;

  if target_mode = 'STRICT' and exists (
    select 1 from public.branches b
    where b.tenant_id = staff_record.tenant_id
      and b.status = 'ACTIVE'
      and (b.latitude is null or b.longitude is null)
  ) then
    return 'MISSING_COORDINATES';
  end if;

  if previous_mode = target_mode then return 'UNCHANGED'; end if;

  update public.tenants
  set location_validation_mode = target_mode
  where id = staff_record.tenant_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id,
    staff_record.id,
    'TENANT_LOCATION_VALIDATION_UPDATED',
    'tenants',
    staff_record.tenant_id,
    jsonb_build_object('previous_mode', previous_mode, 'new_mode', target_mode)
  );
  return 'UPDATED';
end;
$$;

revoke all on function app.validate_operation_location(uuid, uuid, numeric, numeric) from public, anon;
revoke all on function app.enforce_strict_branch_coordinates() from public, anon, authenticated;
revoke all on function app.set_tenant_location_validation_mode(public.location_validation_mode) from public, anon;
grant execute on function app.validate_operation_location(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function app.set_tenant_location_validation_mode(public.location_validation_mode) to authenticated;
