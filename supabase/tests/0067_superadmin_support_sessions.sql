\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  started_session record;
  visible_session record;
  ended boolean;
begin
  select * into started_session
  from app.start_support_impersonation_session(
    '10000000-0000-0000-0000-000000000001',
    repeat('a', 64),
    'Revisar el ticket de soporte SOP-1234'
  );

  if started_session.tenant_id <> '10000000-0000-0000-0000-000000000001'
    or length(started_session.tenant_name) = 0
    or started_session.expires_at <= now() then
    raise exception 'Superadmin support session was not created correctly: tenant=%, name=%, expires=%',
      started_session.tenant_id, started_session.tenant_name, started_session.expires_at;
  end if;

  select * into visible_session
  from app.get_support_impersonation_session(repeat('a', 64));

  if visible_session.tenant_id <> started_session.tenant_id
    or visible_session.tenant_status <> 'ACTIVE'
    or visible_session.reason <> 'Revisar el ticket de soporte SOP-1234' then
    raise exception 'Support session could not be resolved by its owner';
  end if;

  begin
    perform 1 from public.support_impersonation_sessions;
    raise exception 'Authenticated role read support session storage directly';
  exception when insufficient_privilege then
    null;
  end;

  select app.end_support_impersonation_session(repeat('a', 64)) into ended;
  if not ended then
    raise exception 'Superadmin could not end the support session';
  end if;
  if exists (select 1 from app.get_support_impersonation_session(repeat('a', 64))) then
    raise exception 'Ended support session remained active';
  end if;

  if not exists (
    select 1 from public.audit_logs
    where actor_staff_id = '00000000-0000-0000-0000-000000000001'
      and tenant_id = '10000000-0000-0000-0000-000000000001'
      and action = 'SUPPORT_IMPERSONATION_STARTED'
      and metadata->>'mode' = 'READ_ONLY'
  ) or not exists (
    select 1 from public.audit_logs
    where actor_staff_id = '00000000-0000-0000-0000-000000000001'
      and tenant_id = '10000000-0000-0000-0000-000000000001'
      and action = 'SUPPORT_IMPERSONATION_ENDED'
  ) then
    raise exception 'Support lifecycle was not audited';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  begin
    perform app.start_support_impersonation_session(
      '10000000-0000-0000-0000-000000000001',
      repeat('b', 64),
      'Intento no autorizado de soporte'
    );
    raise exception 'Tenant Admin started a support impersonation session';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
begin
  begin
    perform app.start_support_impersonation_session(
      '10000000-0000-0000-0000-000000000003',
      repeat('c', 64),
      'Revisar tenant suspendido con soporte'
    );
    raise exception 'Support session started for a suspended tenant';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;
