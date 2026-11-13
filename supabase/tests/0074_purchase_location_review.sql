\set ON_ERROR_STOP on

insert into public.tenants (id, name, status) values
  ('74000000-0000-0000-0000-0000000000a1', 'Tenant Ubicación', 'ACTIVE');

insert into public.branches (id, tenant_id, name, latitude, longitude, geofence_radius_meters) values
  ('74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-0000000000a1', 'Centro', 29.072967, -110.955919, 100),
  ('74000000-0000-0000-0000-0000000000b2', '74000000-0000-0000-0000-0000000000a1', 'Norte', null, null, 100);

insert into auth.users (id, email) values
  ('74000000-0000-0000-0000-000000000011', 'admin-74@swiftwallet.test'),
  ('74000000-0000-0000-0000-000000000012', 'manager-74@swiftwallet.test'),
  ('74000000-0000-0000-0000-000000000013', 'employee-74@swiftwallet.test');

insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('74000000-0000-0000-0000-000000000011', '74000000-0000-0000-0000-0000000000a1', 'admin-74@swiftwallet.test', 'Admin 74', 'ADMIN', 'ACTIVE'),
  ('74000000-0000-0000-0000-000000000012', '74000000-0000-0000-0000-0000000000a1', 'manager-74@swiftwallet.test', 'Manager 74', 'MANAGER', 'ACTIVE'),
  ('74000000-0000-0000-0000-000000000013', '74000000-0000-0000-0000-0000000000a1', 'employee-74@swiftwallet.test', 'Empleado 74', 'EMPLOYEE', 'ACTIVE');

insert into public.staff_branch_assignments (staff_profile_id, branch_id, tenant_id) values
  ('74000000-0000-0000-0000-000000000012', '74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-0000000000a1'),
  ('74000000-0000-0000-0000-000000000013', '74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-0000000000a1');

insert into public.customers (id, tenant_id, full_name, normalized_phone, privacy_consent, registration_method, source_branch_id) values
  ('74000000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000a1', 'Cliente 74', '+528100007401', true, 'SELF_SERVICE', '74000000-0000-0000-0000-0000000000b1');

-- Inside (~11 m), outside (~1.1 km), no coordinates, and a branch without point.
insert into public.purchases (
  id, tenant_id, customer_id, branch_id, staff_profile_id, ticket_number, amount_minor,
  occurred_at, latitude, longitude, rule_type, program_version
) values
  ('74100000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-000000000013', 'T-1', 10000, now() - interval '3 hours', 29.073067, -110.955919, 'PER_PURCHASE', 1),
  ('74100000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-000000000013', 'T-2', 20000, now() - interval '2 hours', 29.082967, -110.955919, 'PER_PURCHASE', 1),
  ('74100000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000b1', '74000000-0000-0000-0000-000000000013', 'T-3', 30000, now() - interval '1 hour', null, null, 'PER_PURCHASE', 1),
  ('74100000-0000-0000-0000-000000000004', '74000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-0000000000c1', '74000000-0000-0000-0000-0000000000b2', '74000000-0000-0000-0000-000000000011', 'T-4', 40000, now() - interval '30 minutes', 29.1, -110.9, 'PER_PURCHASE', 1);

set role authenticated;

do $$
declare
  rows_count integer;
  inside_count integer;
  outside_distance integer;
begin
  -- Admin sees every branch, classified.
  perform set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000011', false);
  select count(*),
         count(*) filter (where location_result = 'INSIDE'),
         max(distance_meters) filter (where location_result = 'OUTSIDE')
    into rows_count, inside_count, outside_distance
  from app.get_purchase_location_review(current_date - 1, current_date + 1);
  if rows_count <> 4 or inside_count <> 1 or outside_distance not between 1000 and 1200 then
    raise exception 'Admin review mismatch: rows=%, inside=%, outside=%', rows_count, inside_count, outside_distance;
  end if;

  if (select location_result from app.get_purchase_location_review(current_date - 1, current_date + 1)
      where purchase_id = '74100000-0000-0000-0000-000000000003') <> 'NO_COORDINATES'
    or (select location_result from app.get_purchase_location_review(current_date - 1, current_date + 1)
      where purchase_id = '74100000-0000-0000-0000-000000000004') <> 'NO_BRANCH_POINT' then
    raise exception 'Review states were not classified';
  end if;

  -- Filters are applied server side.
  if (select count(*) from app.get_purchase_location_review(current_date - 1, current_date + 1, null, null, 'OUTSIDE')) <> 1
    or (select count(*) from app.get_purchase_location_review(current_date - 1, current_date + 1, null, 'staff:74000000-0000-0000-0000-000000000011')) <> 1 then
    raise exception 'Review filters were not applied';
  end if;

  -- Manager sees only the assigned branch.
  perform set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000012', false);
  if exists (
    select 1 from app.get_purchase_location_review(current_date - 1, current_date + 1)
    where branch_id <> '74000000-0000-0000-0000-0000000000b1'
  ) or (select count(*) from app.get_purchase_location_review(current_date - 1, current_date + 1)) <> 3 then
    raise exception 'Manager saw purchases outside assigned branches';
  end if;

  -- Employees have no location view.
  perform set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000013', false);
  begin
    perform 1 from app.get_purchase_location_review(current_date - 1, current_date);
    raise exception 'Employee reached the location review';
  exception when insufficient_privilege then
    null;
  end;

  -- Another tenant's administrator sees none of these purchases.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
  if exists (
    select 1 from app.get_purchase_location_review(current_date - 1, current_date + 1)
    where purchase_id::text like '741%'
  ) then
    raise exception 'Location review leaked across tenants';
  end if;

  -- Periods are bounded.
  perform set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000011', false);
  begin
    perform 1 from app.get_purchase_location_review(current_date - 120, current_date);
    raise exception 'Unbounded review period was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  if (
    select count(*) from public.audit_logs
    where action = 'PURCHASE_LOCATION_REVIEW_VIEWED'
      and tenant_id = '74000000-0000-0000-0000-0000000000a1'
  ) < 5 then
    raise exception 'Location review access was not audited';
  end if;
end;
$$;
