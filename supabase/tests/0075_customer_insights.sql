\set ON_ERROR_STOP on

insert into public.tenants (id, name, status) values
  ('75000000-0000-0000-0000-0000000000a1', 'Tenant Estadísticas', 'ACTIVE');
insert into public.branches (id, tenant_id, name) values
  ('75000000-0000-0000-0000-0000000000b1', '75000000-0000-0000-0000-0000000000a1', 'Centro'),
  ('75000000-0000-0000-0000-0000000000b2', '75000000-0000-0000-0000-0000000000a1', 'Norte');

insert into auth.users (id, email) values
  ('75000000-0000-0000-0000-000000000011', 'admin-75@swiftwallet.test'),
  ('75000000-0000-0000-0000-000000000012', 'manager-75@swiftwallet.test'),
  ('75000000-0000-0000-0000-000000000013', 'employee-75@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('75000000-0000-0000-0000-000000000011', '75000000-0000-0000-0000-0000000000a1', 'admin-75@swiftwallet.test', 'Admin 75', 'ADMIN', 'ACTIVE'),
  ('75000000-0000-0000-0000-000000000012', '75000000-0000-0000-0000-0000000000a1', 'manager-75@swiftwallet.test', 'Manager 75', 'MANAGER', 'ACTIVE'),
  ('75000000-0000-0000-0000-000000000013', '75000000-0000-0000-0000-0000000000a1', 'employee-75@swiftwallet.test', 'Empleado 75', 'EMPLOYEE', 'ACTIVE');
insert into public.staff_branch_assignments (staff_profile_id, branch_id, tenant_id) values
  ('75000000-0000-0000-0000-000000000012', '75000000-0000-0000-0000-0000000000b1', '75000000-0000-0000-0000-0000000000a1');

-- One customer per segment in Centro, plus a frequent customer in Norte.
insert into public.customers (id, tenant_id, full_name, normalized_phone, privacy_consent, registration_method, source_branch_id, created_at) values
  ('75000000-0000-0000-0000-0000000000c1', '75000000-0000-0000-0000-0000000000a1', 'Nuevo', '+528100007501', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '5 days'),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000a1', 'Frecuente', '+528100007502', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '200 days'),
  ('75000000-0000-0000-0000-0000000000c3', '75000000-0000-0000-0000-0000000000a1', 'Ocasional', '+528100007503', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '200 days'),
  ('75000000-0000-0000-0000-0000000000c4', '75000000-0000-0000-0000-0000000000a1', 'Una visita', '+528100007504', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '100 days'),
  ('75000000-0000-0000-0000-0000000000c5', '75000000-0000-0000-0000-0000000000a1', 'En riesgo', '+528100007505', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '200 days'),
  ('75000000-0000-0000-0000-0000000000c6', '75000000-0000-0000-0000-0000000000a1', 'Perdido', '+528100007506', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '300 days'),
  ('75000000-0000-0000-0000-0000000000c7', '75000000-0000-0000-0000-0000000000a1', 'Nunca', '+528100007507', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b1', now() - interval '100 days'),
  ('75000000-0000-0000-0000-0000000000c8', '75000000-0000-0000-0000-0000000000a1', 'Norte frecuente', '+528100007508', true, 'SELF_SERVICE', '75000000-0000-0000-0000-0000000000b2', now() - interval '200 days');

insert into public.purchases (tenant_id, customer_id, branch_id, staff_profile_id, ticket_number, amount_minor, occurred_at, rule_type, program_version)
select '75000000-0000-0000-0000-0000000000a1', p.customer_id::uuid, p.branch_id::uuid,
       '75000000-0000-0000-0000-000000000011', 'T-' || row_number() over (), 10000,
       now() - (p.days_ago || ' days')::interval, 'PER_PURCHASE', 1
from (values
  ('75000000-0000-0000-0000-0000000000c1', '75000000-0000-0000-0000-0000000000b1', 5),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000b1', 3),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000b1', 40),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000b1', 80),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000b1', 120),
  ('75000000-0000-0000-0000-0000000000c2', '75000000-0000-0000-0000-0000000000b1', 150),
  ('75000000-0000-0000-0000-0000000000c3', '75000000-0000-0000-0000-0000000000b1', 10),
  ('75000000-0000-0000-0000-0000000000c3', '75000000-0000-0000-0000-0000000000b1', 90),
  ('75000000-0000-0000-0000-0000000000c4', '75000000-0000-0000-0000-0000000000b1', 20),
  ('75000000-0000-0000-0000-0000000000c5', '75000000-0000-0000-0000-0000000000b1', 45),
  ('75000000-0000-0000-0000-0000000000c5', '75000000-0000-0000-0000-0000000000b1', 100),
  ('75000000-0000-0000-0000-0000000000c5', '75000000-0000-0000-0000-0000000000b1', 150),
  ('75000000-0000-0000-0000-0000000000c6', '75000000-0000-0000-0000-0000000000b1', 90),
  ('75000000-0000-0000-0000-0000000000c6', '75000000-0000-0000-0000-0000000000b1', 200),
  ('75000000-0000-0000-0000-0000000000c8', '75000000-0000-0000-0000-0000000000b2', 2),
  ('75000000-0000-0000-0000-0000000000c8', '75000000-0000-0000-0000-0000000000b2', 30),
  ('75000000-0000-0000-0000-0000000000c8', '75000000-0000-0000-0000-0000000000b2', 60),
  ('75000000-0000-0000-0000-0000000000c8', '75000000-0000-0000-0000-0000000000b2', 90)
) as p(customer_id, branch_id, days_ago);

set role authenticated;

do $$
declare
  insights jsonb;
  segments jsonb;
begin
  perform set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000011', false);
  insights := app.get_customer_insights(current_date - 29, current_date + 1);
  select jsonb_object_agg(s->>'segment', (s->>'customers')::integer) into segments
  from jsonb_array_elements(insights->'segments') s;

  if segments <> '{"NEW":1,"FREQUENT":2,"OCCASIONAL":1,"ONE_VISIT":1,"AT_RISK":1,"LOST":1,"NEVER_PURCHASED":1}'::jsonb then
    raise exception 'Unexpected admin segments: %', segments;
  end if;
  if insights->'summary'->>'active_customers' <> '5'
    or insights->'summary'->>'returning_customers' <> '3'
    or insights->'summary'->>'new_customers' <> '1' then
    raise exception 'Unexpected admin summary: %', insights->'summary';
  end if;
  if insights->'funnel' <> '{"registered":8,"purchased_1":7,"purchased_2":5,"purchased_3":3}'::jsonb then
    raise exception 'Unexpected funnel: %', insights->'funnel';
  end if;
  if jsonb_array_length(insights->'weekly') <> 12
    or jsonb_array_length(insights->'top_customers') = 0
    or jsonb_array_length(insights->'branches') <> 2 then
    raise exception 'Weekly, top customers or branches missing';
  end if;

  if (select count(*) from app.get_customer_segment_members('AT_RISK')) <> 1
    or (select full_name from app.get_customer_segment_members('AT_RISK')) <> 'En riesgo' then
    raise exception 'Segment members do not match the dashboard';
  end if;

  -- Manager: only Centro, no customer names.
  perform set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000012', false);
  insights := app.get_customer_insights(current_date - 29, current_date + 1);
  select sum((s->>'customers')::integer) into segments
  from jsonb_array_elements(insights->'segments') s;
  if segments::text <> '7'
    or jsonb_array_length(insights->'branches') <> 1
    or jsonb_array_length(insights->'top_customers') <> 0 then
    raise exception 'Manager scope leaked: segments=%, branches=%', segments, insights->'branches';
  end if;
  begin
    perform app.get_customer_insights(current_date - 29, current_date, '75000000-0000-0000-0000-0000000000b2');
    raise exception 'Manager filtered an unassigned branch';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from app.get_customer_segment_members('LOST');
    raise exception 'Manager listed segment members';
  exception when insufficient_privilege then
    null;
  end;

  -- Employees and other tenants.
  perform set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000013', false);
  begin
    perform app.get_customer_insights(current_date - 29, current_date);
    raise exception 'Employee reached insights';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
  if exists (select 1 from app.get_customer_segment_members('FREQUENT') where full_name like '%Frecuente%') then
    raise exception 'Segment members leaked across tenants';
  end if;
end;
$$;

reset role;
