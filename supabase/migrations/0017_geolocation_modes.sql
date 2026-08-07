create type public.location_validation_mode as enum ('FLEXIBLE', 'STRICT');
alter table public.tenants add column location_validation_mode public.location_validation_mode not null default 'FLEXIBLE';

create or replace function app.validate_operation_location(
  target_tenant_id uuid,
  target_branch_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns boolean
language plpgsql stable security definer
set search_path = public, app, auth, extensions
as $$
declare tenant_mode public.location_validation_mode; branch_record record; distance_meters numeric;
begin
  select location_validation_mode into tenant_mode from public.tenants where id = target_tenant_id;
  if tenant_mode <> 'STRICT' then return true; end if;
  if target_latitude is null or target_longitude is null then return false; end if;
  select latitude, longitude, geofence_radius_meters into branch_record from public.branches where id = target_branch_id;
  if branch_record.latitude is null or branch_record.longitude is null then return false; end if;
  distance_meters := 6371000 * 2 * asin(sqrt(
    sin(radians((target_latitude - branch_record.latitude) / 2)) ^ 2
    + cos(radians(branch_record.latitude)) * cos(radians(target_latitude))
    * sin(radians((target_longitude - branch_record.longitude) / 2)) ^ 2
  ));
  return distance_meters <= branch_record.geofence_radius_meters;
end;
$$;

create or replace function app.enforce_purchase_location()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.validate_operation_location(new.tenant_id, new.branch_id, new.latitude, new.longitude) then
    raise exception 'operation location is outside the branch geofence' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger purchases_validate_location before insert on public.purchases
  for each row execute function app.enforce_purchase_location();

create or replace function app.enforce_redemption_location()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.validate_operation_location(new.tenant_id, new.branch_id, new.latitude, new.longitude) then
    raise exception 'operation location is outside the branch geofence' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reward_redemptions_validate_location before insert on public.reward_redemptions
  for each row execute function app.enforce_redemption_location();
