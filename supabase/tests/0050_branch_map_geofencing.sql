\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  if app.set_tenant_location_validation_mode('STRICT') <> 'MISSING_COORDINATES' then
    raise exception 'Strict mode should require coordinates for every active branch';
  end if;
end;
$$;

reset role;
update public.branches
set latitude = 23.2494, longitude = -106.4111, geofence_radius_meters = 150
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and status = 'ACTIVE';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  if app.set_tenant_location_validation_mode('STRICT') <> 'UPDATED' then
    raise exception 'Tenant Admin could not enable strict location validation';
  end if;
  if not app.validate_operation_location(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    23.2494,
    -106.4111
  ) then
    raise exception 'Exact branch location was rejected';
  end if;
  if app.validate_operation_location(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    23.2594,
    -106.4111
  ) then
    raise exception 'Far location was accepted';
  end if;
  if app.validate_operation_location(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    null,
    null
  ) then
    raise exception 'Missing strict location was accepted';
  end if;

  begin
    insert into public.branches (tenant_id, name)
    values ('10000000-0000-0000-0000-000000000001', 'Strict without map');
    raise exception 'Strict branch without coordinates was accepted';
  exception when check_violation then null;
  end;

  if not exists (
    select 1 from public.audit_logs
    where tenant_id = '10000000-0000-0000-0000-000000000001'
      and action = 'TENANT_LOCATION_VALIDATION_UPDATED'
      and metadata ->> 'new_mode' = 'STRICT'
  ) then
    raise exception 'Strict mode change was not audited';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
do $$
begin
  if app.set_tenant_location_validation_mode('FLEXIBLE') <> 'UNAVAILABLE' then
    raise exception 'Non-Admin changed the tenant location mode';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
do $$
begin
  if app.set_tenant_location_validation_mode('FLEXIBLE') <> 'UPDATED' then
    raise exception 'Tenant Admin could not restore flexible mode';
  end if;
end;
$$;

reset role;
select 'Branch map geofencing assertions passed' as result;
