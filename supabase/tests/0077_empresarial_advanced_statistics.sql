\set ON_ERROR_STOP on

insert into public.tenants (id, name, status) values
  ('77000000-0000-0000-0000-0000000000a1', 'Tenant Básico', 'ACTIVE');
insert into public.branches (id, tenant_id, name) values
  ('77000000-0000-0000-0000-0000000000b1', '77000000-0000-0000-0000-0000000000a1', 'Centro');
insert into auth.users (id, email) values
  ('77000000-0000-0000-0000-000000000011', 'admin-77@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('77000000-0000-0000-0000-000000000011', '77000000-0000-0000-0000-0000000000a1', 'admin-77@swiftwallet.test', 'Admin 77', 'ADMIN', 'ACTIVE');

set role authenticated;

do $$
declare
  insights jsonb;
begin
  perform set_config('request.jwt.claim.sub', '77000000-0000-0000-0000-000000000011', false);
  if app.current_tenant_empresarial_available() then
    raise exception 'Basic tenant reported Empresarial';
  end if;

  insights := app.get_customer_insights(current_date - 29, current_date);
  if insights->>'advanced' <> 'false'
    or insights ? 'segments' or insights ? 'funnel' or insights ? 'weekly'
    or insights ? 'heatmap' or insights ? 'top_customers' or insights ? 'branches'
    or not (insights ? 'summary') or not (insights ? 'rewards') then
    raise exception 'Basic tenant received advanced statistics: %', insights;
  end if;

  begin
    perform 1 from app.get_customer_segment_members('LOST');
    raise exception 'Basic tenant listed segment members';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform app.customer_insights_full(current_date - 29, current_date, null);
    raise exception 'Internal insights function is callable';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  perform app.set_tenant_campaigns_enabled('77000000-0000-0000-0000-0000000000a1', true);

  perform set_config('request.jwt.claim.sub', '77000000-0000-0000-0000-000000000011', false);
  insights := app.get_customer_insights(current_date - 29, current_date);
  if insights->>'advanced' <> 'true' or not (insights ? 'segments') or not (insights ? 'funnel') then
    raise exception 'Empresarial tenant did not receive advanced statistics';
  end if;
  perform 1 from app.get_customer_segment_members('LOST');
end;
$$;

reset role;
