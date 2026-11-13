\set ON_ERROR_STOP on

-- Tenant A pays a package that includes test_reports; tenant B pays nothing.
insert into public.tenants (id, name, status) values
  ('80000000-0000-0000-0000-0000000000a1', 'Tenant Módulos A', 'ACTIVE'),
  ('80000000-0000-0000-0000-0000000000a2', 'Tenant Módulos B', 'ACTIVE');
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000011', 'admin-80@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-0000000000a1', 'admin-80@swiftwallet.test', 'Admin 80', 'ADMIN', 'ACTIVE');
insert into public.billing_packages (id, code, name, status, entitlements) values
  ('80000000-0000-0000-0000-0000000000f1', 'modules-test', 'Módulos prueba', 'ACTIVE',
   '{"appleWallet":true,"modules":["test_reports"]}'::jsonb);
insert into public.tenant_subscriptions (
  id, tenant_id, package_id, status, billing_interval, currency_code, amount_minor,
  package_code_snapshot, package_name_snapshot, entitlements_snapshot,
  current_period_start, current_period_end
) values (
  '80000000-0000-0000-0000-0000000000e1', '80000000-0000-0000-0000-0000000000a1',
  '80000000-0000-0000-0000-0000000000f1', 'ACTIVE', 'MONTH', 'MXN', 0,
  'modules-test', 'Módulos prueba', '{"appleWallet":true,"modules":["test_reports"]}'::jsonb,
  now() - interval '1 day', now() + interval '29 days'
);

set role authenticated;

do $$
declare
  a constant uuid := '80000000-0000-0000-0000-0000000000a1';
  b constant uuid := '80000000-0000-0000-0000-0000000000a2';
  overview record;
begin
  -- Tenant Admin: no access to global controls or state tables.
  perform set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000011', false);
  begin
    perform app.set_module_global('test_reports', 'ON', 'Prueba de permisos');
    raise exception 'Tenant admin changed a global module';
  exception when insufficient_privilege then null;
  end;
  begin
    perform app.set_tenant_module('test_reports', a, 'GRANTED', null, 'Prueba de permisos');
    raise exception 'Tenant admin granted a module';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from app.get_module_overview(array['test_reports']);
    raise exception 'Tenant admin read the module overview';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from app.get_module_tenants('test_reports');
    raise exception 'Tenant admin listed module tenants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform app.tenant_has_module('test_reports', b);
    raise exception 'Tenant admin evaluated another tenant';
  exception when insufficient_privilege then null;
  end;
  -- Born OFF: no row means inactive even when the plan includes it.
  if app.current_tenant_has_module('test_reports') then
    raise exception 'Module active without a global state';
  end if;

  -- Superadmin turns it ON: plan decides.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  if app.set_module_global('test_reports', 'ON', '  ') <> 'INVALID' then
    raise exception 'Blank reason accepted';
  end if;
  if app.set_module_global('Bad Key', 'ON', 'Clave inválida') <> 'INVALID' then
    raise exception 'Invalid key accepted';
  end if;
  if app.set_module_global('test_reports', 'ON', 'Liberación general') <> 'UPDATED' then
    raise exception 'Superadmin could not turn the module on';
  end if;
  if not (select active from app.get_tenant_modules(a, array['test_reports'])) then
    raise exception 'Paying tenant should have the module';
  end if;
  if (select active from app.get_tenant_modules(b, array['test_reports'])) then
    raise exception 'Non paying tenant should not have the module';
  end if;

  -- GRANTED and REVOKED overrides.
  if app.set_tenant_module('test_reports', b, 'GRANTED', now() - interval '1 day', 'Cortesía') <> 'INVALID' then
    raise exception 'Expired grant accepted';
  end if;
  if app.set_tenant_module('test_reports', b, 'REVOKED', now() + interval '1 day', 'Revocación') <> 'INVALID' then
    raise exception 'Expiry accepted on a revocation';
  end if;
  if app.set_tenant_module('test_reports', '80000000-0000-0000-0000-0000000000ff', 'GRANTED', null, 'No existe') <> 'NOT_FOUND' then
    raise exception 'Unknown tenant accepted';
  end if;
  if app.set_tenant_module('test_reports', b, 'GRANTED', now() + interval '7 days', 'Piloto') <> 'UPDATED' then
    raise exception 'Superadmin could not grant the module';
  end if;
  if not (select active from app.get_tenant_modules(b, array['test_reports'])) then
    raise exception 'Grant did not activate the module: %',
      (select row_to_json(m) from app.get_tenant_modules(b, array['test_reports']) m);
  end if;
  -- Write and read in separate statements: a statement reads its starting snapshot.
  if app.set_tenant_module('test_reports', a, 'REVOKED', null, 'Falla reportada') <> 'UPDATED' then
    raise exception 'Superadmin could not revoke the module';
  end if;
  if (select active from app.get_tenant_modules(a, array['test_reports'])) then
    raise exception 'Revocation did not win over the plan';
  end if;

  -- Switches follow their module and can be stopped globally or per tenant.
  if not (select active from app.get_tenant_modules(b, array['test_reports.export'])) then
    raise exception 'Switch without state should follow its module';
  end if;
  if (select active from app.get_tenant_modules(a, array['test_reports.export'])) then
    raise exception 'Switch active while its module is revoked';
  end if;
  perform app.set_tenant_module('test_reports.export', b, 'REVOKED', null, 'Exportación con error');
  if (select active from app.get_tenant_modules(b, array['test_reports.export'])) then
    raise exception 'Revoked switch still active';
  end if;
  perform app.set_tenant_module('test_reports.export', b, 'INHERIT', null, 'Exportación corregida');
  perform app.set_module_global('test_reports.export', 'OFF', 'Apagado de emergencia');
  if (select active from app.get_tenant_modules(b, array['test_reports.export'])) then
    raise exception 'Switch active while globally off';
  end if;

  -- INHERIT restores the plan; BETA limits to grants; OFF stops everybody.
  perform app.set_tenant_module('test_reports', a, 'INHERIT', null, 'Falla resuelta');
  if not (select active from app.get_tenant_modules(a, array['test_reports'])) then
    raise exception 'Inherit did not restore the plan';
  end if;
  perform app.set_module_global('test_reports', 'BETA', 'Solo piloto');
  if (select active from app.get_tenant_modules(a, array['test_reports']))
    or not (select active from app.get_tenant_modules(b, array['test_reports'])) then
    raise exception 'Beta should only include granted tenants';
  end if;
  perform app.set_module_global('test_reports', 'OFF', 'Apagado de emergencia');
  if (select active from app.get_tenant_modules(b, array['test_reports'])) then
    raise exception 'Global off did not win over a grant';
  end if;

  perform app.set_module_global('test_reports', 'ON', 'Reactivación');
  select * into overview from app.get_module_overview(array['test_reports']);
  if overview.mode <> 'ON' or overview.plan_tenants <> 1 or overview.granted_tenants <> 1
    or overview.revoked_tenants <> 0 or overview.active_tenants <> 2 then
    raise exception 'Unexpected overview: %', row_to_json(overview);
  end if;

  if (select count(*) from app.get_module_tenants('test_reports')
      where tenant_id in (a, b) and active) <> 2
    or (select included_in_plan from app.get_module_tenants('test_reports') where tenant_id = b)
    or (select override_state from app.get_module_tenants('test_reports') where tenant_id = b) <> 'GRANTED' then
    raise exception 'Unexpected module tenant list';
  end if;

  -- Package modules: additions reach current subscriptions, removals do not.
  if app.set_billing_package_modules('80000000-0000-0000-0000-0000000000f1', array['test_reports.export'], 'Inválido') <> 'INVALID' then
    raise exception 'Switch accepted as package module';
  end if;
  if app.set_billing_package_modules('80000000-0000-0000-0000-0000000000f1', array['test_reports', 'test_crm', 'test_crm'], 'Nuevo módulo CRM') <> 'UPDATED' then
    raise exception 'Superadmin could not set package modules';
  end if;
  if (select entitlements from public.billing_packages where id = '80000000-0000-0000-0000-0000000000f1')
    <> '{"appleWallet":true,"modules":["test_crm","test_reports"]}'::jsonb then
    raise exception 'Package entitlements not merged';
  end if;
  if not (select entitlements_snapshot -> 'modules' ? 'test_crm'
          from public.tenant_subscriptions where id = '80000000-0000-0000-0000-0000000000e1') then
    raise exception 'Added module did not reach the current subscription';
  end if;
  perform app.set_billing_package_modules('80000000-0000-0000-0000-0000000000f1', array['test_crm'], 'Retiro de reportes');
  if not (select entitlements_snapshot -> 'modules' ? 'test_reports'
          from public.tenant_subscriptions where id = '80000000-0000-0000-0000-0000000000e1') then
    raise exception 'Removal took a paid module from a current subscription';
  end if;

  if (select count(*) from public.audit_logs
      where action in ('MODULE_GLOBAL_UPDATED', 'TENANT_MODULE_UPDATED', 'BILLING_PACKAGE_MODULES_UPDATED')
        and metadata ->> 'module' is distinct from 'x') < 10 then
    raise exception 'Module changes were not audited';
  end if;

  -- Tenant view of its own modules.
  perform set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000011', false);
  if not app.current_tenant_has_module('test_reports') then
    raise exception 'Tenant should see its paid module';
  end if;
  if (select count(*) from public.module_states) <> 0
    or (select count(*) from public.tenant_module_overrides) <> 0 then
    raise exception 'Tenant admin can read module state tables';
  end if;
end;
$$;

reset role;

-- Ended subscriptions and expired grants do not count.
update public.tenant_subscriptions set ended_at = now(), status = 'CANCELED'
where id = '80000000-0000-0000-0000-0000000000e1';
update public.tenant_module_overrides set expires_at = now() - interval '1 minute'
where module_key = 'test_reports' and tenant_id = '80000000-0000-0000-0000-0000000000a2';

do $$
begin
  if app.tenant_has_module('test_reports', '80000000-0000-0000-0000-0000000000a1') then
    raise exception 'Ended subscription still grants the module';
  end if;
  if app.tenant_has_module('test_reports', '80000000-0000-0000-0000-0000000000a2') then
    raise exception 'Expired grant still active';
  end if;
end;
$$;
