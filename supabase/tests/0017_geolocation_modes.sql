\set ON_ERROR_STOP on

update public.tenants set location_validation_mode = 'STRICT'
where id = '10000000-0000-0000-0000-000000000001';
update public.loyalty_programs set status = 'ACTIVE'
where tenant_id = '10000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
begin
  begin
    perform * from app.confirm_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'STRICT-NO-LOCATION', 15000, null, null);
    raise exception 'Strict geolocation accepted missing location';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
update public.tenants set location_validation_mode = 'FLEXIBLE'
where id = '10000000-0000-0000-0000-000000000001';
select 'Geolocation mode assertions passed' as result;
