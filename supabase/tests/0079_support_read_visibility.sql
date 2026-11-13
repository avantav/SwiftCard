\set ON_ERROR_STOP on

insert into public.tenants (id, name, status, campaigns_enabled) values
  ('79000000-0000-0000-0000-0000000000a1', 'Tenant Soporte', 'ACTIVE', true);
insert into public.branches (id, tenant_id, name, latitude, longitude) values
  ('79000000-0000-0000-0000-0000000000b1', '79000000-0000-0000-0000-0000000000a1', 'Centro', 29.07, -110.95);
insert into auth.users (id, email) values
  ('79000000-0000-0000-0000-000000000011', 'admin-79@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('79000000-0000-0000-0000-000000000011', '79000000-0000-0000-0000-0000000000a1', 'admin-79@swiftwallet.test', 'Admin 79', 'ADMIN', 'ACTIVE');
insert into public.customers (id, tenant_id, full_name, normalized_phone, privacy_consent, registration_method, source_branch_id, created_at) values
  ('79000000-0000-0000-0000-0000000000c1', '79000000-0000-0000-0000-0000000000a1', 'Cliente 79', '+528100007901', true, 'SELF_SERVICE', '79000000-0000-0000-0000-0000000000b1', now() - interval '90 days');
insert into public.purchases (tenant_id, customer_id, branch_id, staff_profile_id, ticket_number, amount_minor, occurred_at, latitude, longitude, rule_type, program_version) values
  ('79000000-0000-0000-0000-0000000000a1', '79000000-0000-0000-0000-0000000000c1', '79000000-0000-0000-0000-0000000000b1', '79000000-0000-0000-0000-000000000011', 'S-1', 15000, now() - interval '2 days', 29.07, -110.95, 'PER_PURCHASE', 1);

-- Superadmin (fixture 0001) with an open support session, and an expired one.
insert into public.support_impersonation_sessions (superadmin_staff_id, tenant_id, token_hash, reason, created_at, expires_at) values
  ('00000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-0000000000a1', repeat('7', 64), 'Revisar estadísticas del negocio', now(), now() + interval '50 minutes'),
  ('00000000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-0000000000a1', repeat('8', 64), 'Sesión vencida de prueba', now() - interval '2 hours', now() - interval '1 hour');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  insights jsonb;
begin
  -- Without a token, or with an expired or unknown token: nothing.
  foreach insights in array array[null, to_jsonb(repeat('8', 64)), to_jsonb(repeat('9', 64))] loop
    begin
      perform app.get_customer_insights(current_date - 29, current_date, null, insights #>> '{}');
      raise exception 'Insights without a valid support session';
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  -- Open session: full read as the tenant Admin.
  insights := app.get_customer_insights(current_date - 29, current_date, null, repeat('7', 64));
  if insights->>'advanced' <> 'true' or (insights->'summary'->>'active_customers')::integer <> 1 then
    raise exception 'Support insights unexpected: %', insights;
  end if;
  if (select count(*) from app.get_customer_segment_members('NEW', null, repeat('7', 64))) <> 0
    or (select count(*) from app.get_customer_segment_members('ONE_VISIT', null, repeat('7', 64))) <> 1 then
    raise exception 'Support segment members unexpected';
  end if;
  if (select count(*) from app.get_purchase_location_review(current_date - 6, current_date, null, null, null, repeat('7', 64))) <> 1 then
    raise exception 'Support location review unexpected';
  end if;
  if not app.current_tenant_empresarial_available(repeat('7', 64))
    or not app.current_tenant_campaigns_available(repeat('7', 64))
    or app.current_tenant_campaigns_available() then
    raise exception 'Support plan checks unexpected';
  end if;
  perform app.preview_marketing_campaign(array['ONE_VISIT'], null, repeat('7', 64));
end;
$$;

do $$
begin
  -- Even after a support read in the same transaction, creation is refused.
  perform app.get_customer_insights(current_date - 29, current_date, null, repeat('7', 64));
  begin
    perform app.create_marketing_campaign('Soporte', array['ONE_VISIT'], null, true, 'Hola', 'Mensaje', false, null);
    raise exception 'Support created a campaign';
  exception when insufficient_privilege then
    null;
  end;

  -- The location review is audited with the Superadmin as actor.
  if not exists (
    select 1 from public.audit_logs
    where action = 'PURCHASE_LOCATION_REVIEW_VIEWED'
      and tenant_id = '79000000-0000-0000-0000-0000000000a1'
      and actor_staff_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Support location review was not audited';
  end if;
end;
$$;

-- A tenant admin keeps working without a token.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-000000000011', false);
do $$
begin
  if (app.get_customer_insights(current_date - 29, current_date))->>'advanced' <> 'true' then
    raise exception 'Tenant admin lost access';
  end if;
end;
$$;

reset role;
