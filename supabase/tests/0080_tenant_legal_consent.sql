\set ON_ERROR_STOP on

insert into public.tenants (id, name, status, contact_email) values
  ('80000000-0000-0000-0000-0000000000a1', 'Tenant Legal', 'ACTIVE', 'dueno@legal.test');
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000011', 'admin-80@swiftwallet.test'),
  ('80000000-0000-0000-0000-000000000012', 'manager-80@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-0000000000a1', 'admin-80@swiftwallet.test', 'Admin 80', 'ADMIN', 'ACTIVE'),
  ('80000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-0000000000a1', 'manager-80@swiftwallet.test', 'Manager 80', 'MANAGER', 'ACTIVE');

set role authenticated;

-- Admin general: must complete the legal identity before accepting.
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000011', false);
do $$
declare
  status record;
begin
  select * into status from app.get_my_legal_status('1.1');
  if not status.acceptance_required or not status.company_info_required or not status.can_edit_company
    or status.contact_email <> 'dueno@legal.test' then
    raise exception 'Admin initial legal status unexpected: %', status;
  end if;

  begin
    perform app.accept_platform_legal_terms('1.1');
    raise exception 'Admin accepted without legal identity';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform app.complete_admin_legal_onboarding('1.1', 'Legal Ejemplo, S.A. de C.V.', 'corta', null);
    raise exception 'Short address accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform app.complete_admin_legal_onboarding('1.1', 'Legal Ejemplo, S.A. de C.V.', 'Calle Uno 123, Centro, 83000 Hermosillo, Sonora', 'no-es-correo');
    raise exception 'Invalid privacy email accepted';
  exception when invalid_parameter_value then
    null;
  end;

  perform app.complete_admin_legal_onboarding('1.1', '  Legal Ejemplo, S.A. de C.V. ', 'Calle Uno 123, Centro, 83000 Hermosillo, Sonora', 'Privacidad@Legal.test');

  select * into status from app.get_my_legal_status('1.1');
  if status.acceptance_required or status.company_info_required
    or status.legal_name <> 'Legal Ejemplo, S.A. de C.V.'
    or status.legal_contact_email <> 'privacidad@legal.test' then
    raise exception 'Admin status after onboarding unexpected: %', status;
  end if;

  -- Accepting twice keeps a single record; a new version asks again.
  perform app.accept_platform_legal_terms('1.1');
  select * into status from app.get_my_legal_status('1.2');
  if not status.acceptance_required or status.company_info_required then
    raise exception 'Version bump not required: %', status;
  end if;

  -- Null arguments keep the stored identity.
  perform app.complete_admin_legal_onboarding('1.2', null, null, null);
  select * into status from app.get_my_legal_status('1.2');
  if status.acceptance_required or status.legal_name <> 'Legal Ejemplo, S.A. de C.V.' then
    raise exception 'Re-acceptance lost the identity: %', status;
  end if;

  -- Tables are not writable directly.
  begin
    insert into public.staff_legal_acceptances (tenant_id, staff_profile_id, acceptance_kind, version)
    values ('80000000-0000-0000-0000-0000000000a1', '80000000-0000-0000-0000-000000000011', 'BUSINESS', '9.9');
    raise exception 'Direct acceptance insert allowed';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.tenants set legal_name = 'Otro' where id = '80000000-0000-0000-0000-0000000000a1';
    if found then
      raise exception 'Direct tenant legal update allowed';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- Branch manager: only accepts as a user; cannot edit the legal identity.
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000012', false);
do $$
declare
  status record;
begin
  select * into status from app.get_my_legal_status('1.1');
  if not status.acceptance_required or status.company_info_required or status.can_edit_company then
    raise exception 'Manager legal status unexpected: %', status;
  end if;

  begin
    perform app.update_tenant_legal_profile('Intento', 'Calle Dos 456, Hermosillo, Sonora', null);
    raise exception 'Manager edited the legal identity';
  exception when insufficient_privilege then
    null;
  end;

  perform app.accept_platform_legal_terms('1.1');
  select * into status from app.get_my_legal_status('1.1');
  if status.acceptance_required then
    raise exception 'Manager acceptance not recorded';
  end if;
end;
$$;

-- Superadmin has no tenant acceptance to give.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
begin
  if exists (select 1 from app.get_my_legal_status('1.1')) then
    raise exception 'Superadmin received a legal status';
  end if;
  begin
    perform app.accept_platform_legal_terms('1.1');
    raise exception 'Superadmin accepted tenant terms';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from public.staff_legal_acceptances where tenant_id = '80000000-0000-0000-0000-0000000000a1') <> 3 then
    raise exception 'Unexpected acceptance count';
  end if;
  if (select count(*) from public.staff_legal_acceptances where tenant_id = '80000000-0000-0000-0000-0000000000a1' and acceptance_kind = 'BUSINESS') <> 2 then
    raise exception 'Unexpected business acceptance count';
  end if;
  if (select count(*) from public.audit_logs where tenant_id = '80000000-0000-0000-0000-0000000000a1' and action = 'PLATFORM_LEGAL_TERMS_ACCEPTED') <> 3
    or (select count(*) from public.audit_logs where tenant_id = '80000000-0000-0000-0000-0000000000a1' and action = 'TENANT_LEGAL_PROFILE_UPDATED') <> 2 then
    raise exception 'Legal actions were not audited';
  end if;
  begin
    update public.staff_legal_acceptances set version = '0.1' where tenant_id = '80000000-0000-0000-0000-0000000000a1';
    raise exception 'Acceptance updated';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
