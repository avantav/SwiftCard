\set ON_ERROR_STOP on

-- Uses the Superadmin 0000…0001, tenant 7300…a1 (0073 test) and the Admin
-- general / manager created by the 0082 test in that tenant.

set role authenticated;

-- Only the Superadmin creates orders.
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000011', false);
do $$
begin
  begin
    perform app.create_tenant_service_order(
      '73000000-0000-0000-0000-0000000000a1', 'Empresarial', 150000, 'MXN', 'MONTH',
      'Tres sucursales y campañas', 'Integraciones a la medida', current_date, null);
    raise exception 'Tenant admin created a service order';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare
  first_id uuid;
  second_id uuid;
begin
  first_id := app.create_tenant_service_order(
    '73000000-0000-0000-0000-0000000000a1', 'Empresarial', 150000, 'mxn', 'MONTH',
    'Tres sucursales, campañas y estadísticas avanzadas', 'Integraciones y diseño a la medida', current_date, null);
  second_id := app.create_tenant_service_order(
    '73000000-0000-0000-0000-0000000000a1', 'Empresarial', 180000, 'MXN', 'MONTH',
    'Cinco sucursales, campañas y estadísticas avanzadas', 'Integraciones y diseño a la medida', current_date, null);
  if (select version from public.tenant_service_orders where id = second_id) <> 2
    or (select currency_code from public.tenant_service_orders where id = first_id) <> 'MXN' then
    raise exception 'Service order versions or currency unexpected';
  end if;
  perform set_config('test.order_v1', first_id::text, false);
  perform set_config('test.order_v2', second_id::text, false);
end;
$$;

-- Branch manager can neither read nor accept.
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000012', false);
do $$
begin
  if exists (select 1 from public.tenant_service_orders) then
    raise exception 'Manager can read service orders';
  end if;
  if app.accept_my_service_order(current_setting('test.order_v2')::uuid) <> 'UNAVAILABLE' then
    raise exception 'Manager accepted a service order';
  end if;
end;
$$;

-- Admin general reads its orders, cannot accept a superseded one, accepts the latest once.
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000011', false);
do $$
begin
  if (select count(*) from public.tenant_service_orders) <> 2 then
    raise exception 'Admin general cannot read its service orders';
  end if;
  if app.accept_my_service_order(current_setting('test.order_v1')::uuid) <> 'SUPERSEDED' then
    raise exception 'Superseded order was accepted';
  end if;
  if app.accept_my_service_order(current_setting('test.order_v2')::uuid) <> 'ACCEPTED' then
    raise exception 'Admin general could not accept the latest order';
  end if;
  if app.accept_my_service_order(current_setting('test.order_v2')::uuid) <> 'ALREADY_ACCEPTED' then
    raise exception 'Order accepted twice';
  end if;
  begin
    update public.tenant_service_orders set price_minor = 1;
    if found then
      raise exception 'Admin general updated a service order directly';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

do $$
declare
  accepted record;
begin
  select * into accepted from public.tenant_service_orders where id = current_setting('test.order_v2')::uuid;
  if accepted.accepted_by_staff_id <> '82000000-0000-0000-0000-000000000011' or accepted.accepted_at is null then
    raise exception 'Acceptance not recorded';
  end if;
  if (select count(*) from public.audit_logs where entity_type = 'tenant_service_orders'
      and action in ('SERVICE_ORDER_CREATED', 'SERVICE_ORDER_ACCEPTED')
      and tenant_id = '73000000-0000-0000-0000-0000000000a1') <> 3 then
    raise exception 'Service order actions were not audited';
  end if;

  -- Immutable even for privileged paths once accepted.
  begin
    update public.tenant_service_orders set price_minor = 1 where id = accepted.id;
    raise exception 'Accepted order was modified';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    delete from public.tenant_service_orders where id = accepted.id;
    raise exception 'Service order was deleted';
  exception when object_not_in_prerequisite_state then
    null;
  end;
end;
$$;
