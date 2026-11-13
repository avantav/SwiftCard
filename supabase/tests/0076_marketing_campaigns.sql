\set ON_ERROR_STOP on

insert into public.tenants (id, name, status) values
  ('76000000-0000-0000-0000-0000000000a1', 'Tenant Campañas', 'ACTIVE');
insert into public.branches (id, tenant_id, name) values
  ('76000000-0000-0000-0000-0000000000b1', '76000000-0000-0000-0000-0000000000a1', 'Centro');
insert into auth.users (id, email) values
  ('76000000-0000-0000-0000-000000000011', 'admin-76@swiftwallet.test'),
  ('76000000-0000-0000-0000-000000000012', 'manager-76@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('76000000-0000-0000-0000-000000000011', '76000000-0000-0000-0000-0000000000a1', 'admin-76@swiftwallet.test', 'Admin 76', 'ADMIN', 'ACTIVE'),
  ('76000000-0000-0000-0000-000000000012', '76000000-0000-0000-0000-0000000000a1', 'manager-76@swiftwallet.test', 'Manager 76', 'MANAGER', 'ACTIVE');
insert into public.staff_branch_assignments (staff_profile_id, branch_id, tenant_id) values
  ('76000000-0000-0000-0000-000000000012', '76000000-0000-0000-0000-0000000000b1', '76000000-0000-0000-0000-0000000000a1');

-- All are NEW (registered recently). c1 consent+email+Google pass, c2 consent
-- without email but with Google pass, c3 no consent, c4 consent+email but
-- already reached by another campaign 3 days ago.
insert into public.customers (id, tenant_id, full_name, normalized_phone, email, privacy_consent, marketing_consent, marketing_consent_at, marketing_consent_source, registration_method, source_branch_id, created_at) values
  ('76000000-0000-0000-0000-0000000000c1', '76000000-0000-0000-0000-0000000000a1', 'Uno', '+528100007601', 'uno@example.com', true, true, now(), 'SELF_SERVICE', 'SELF_SERVICE', '76000000-0000-0000-0000-0000000000b1', now() - interval '1 day'),
  ('76000000-0000-0000-0000-0000000000c2', '76000000-0000-0000-0000-0000000000a1', 'Dos', '+528100007602', null, true, true, now(), 'SELF_SERVICE', 'SELF_SERVICE', '76000000-0000-0000-0000-0000000000b1', now() - interval '1 day'),
  ('76000000-0000-0000-0000-0000000000c3', '76000000-0000-0000-0000-0000000000a1', 'Tres', '+528100007603', 'tres@example.com', true, false, null, null, 'SELF_SERVICE', '76000000-0000-0000-0000-0000000000b1', now() - interval '1 day'),
  ('76000000-0000-0000-0000-0000000000c4', '76000000-0000-0000-0000-0000000000a1', 'Cuatro', '+528100007604', 'cuatro@example.com', true, true, now(), 'SELF_SERVICE', 'SELF_SERVICE', '76000000-0000-0000-0000-0000000000b1', now() - interval '1 day');
insert into public.customer_cards (id, tenant_id, customer_id) values
  ('76000000-0000-0000-0000-0000000000d1', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c1'),
  ('76000000-0000-0000-0000-0000000000d2', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c2'),
  ('76000000-0000-0000-0000-0000000000d3', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c3'),
  ('76000000-0000-0000-0000-0000000000d4', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c4');
insert into public.wallet_passes (id, tenant_id, customer_id, customer_card_id, provider, status, serial_number) values
  ('76000000-0000-0000-0000-0000000000e1', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c1', '76000000-0000-0000-0000-0000000000d1', 'GOOGLE', 'ACTIVE', 'g-76-1'),
  ('76000000-0000-0000-0000-0000000000e2', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c2', '76000000-0000-0000-0000-0000000000d2', 'GOOGLE', 'ACTIVE', 'g-76-2');

insert into public.marketing_campaigns (id, tenant_id, name, segments, send_email, email_subject, email_body, status, created_at) values
  ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-0000000000a1', 'Anterior', array['NEW'], true, 'Hola', 'Mensaje', 'SENT', now() - interval '3 days');
insert into public.marketing_campaign_recipients (campaign_id, tenant_id, customer_id, customer_card_id, channel, status, created_at) values
  ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-0000000000a1', '76000000-0000-0000-0000-0000000000c4', '76000000-0000-0000-0000-0000000000d4', 'EMAIL', 'SENT', now() - interval '3 days');

set role authenticated;

do $$
declare
  preview jsonb;
  created uuid;
begin
  -- Not Empresarial yet.
  perform set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-000000000011', false);
  if app.current_tenant_campaigns_available() then
    raise exception 'Campaigns available without Empresarial';
  end if;
  begin
    perform app.preview_marketing_campaign(array['NEW']);
    raise exception 'Preview allowed without Empresarial';
  exception when insufficient_privilege then
    null;
  end;

  -- Tenant admins cannot enable it themselves.
  begin
    perform app.set_tenant_campaigns_enabled('76000000-0000-0000-0000-0000000000a1', true);
    raise exception 'Tenant admin enabled campaigns';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  if not app.set_tenant_campaigns_enabled('76000000-0000-0000-0000-0000000000a1', true) then
    raise exception 'Superadmin could not enable campaigns';
  end if;

  perform set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-000000000011', false);
  preview := app.preview_marketing_campaign(array['NEW']);
  if preview <> '{"customers":4,"without_consent":1,"capped":1,"email":1,"wallet":2,"apple":0,"google":2}'::jsonb then
    raise exception 'Unexpected preview: %', preview;
  end if;

  created := app.create_marketing_campaign('Regreso', array['NEW'], null, true, 'Te extrañamos', 'Vuelve pronto', true, 'Te esperamos esta semana');
  if (select recipient_count from public.marketing_campaigns where id = created) <> 3 then
    raise exception 'Unexpected recipient count';
  end if;

  begin
    perform app.create_marketing_campaign('Doble', array['NEW'], null, true, 'Otra', 'Otra', false, null);
    raise exception 'Two campaigns were created within a minute';
  exception when lock_not_available then
    null;
  end;

  -- Recipients are now capped for 7 days.
  preview := app.preview_marketing_campaign(array['NEW']);
  if (preview->>'capped')::integer <> 3 then
    raise exception 'Frequency cap not applied after sending: %', preview;
  end if;

  -- Managers and other tenants have no access.
  perform set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-000000000012', false);
  begin
    perform app.preview_marketing_campaign(array['NEW']);
    raise exception 'Manager previewed a campaign';
  exception when insufficient_privilege then
    null;
  end;
  if exists (select 1 from public.marketing_campaigns) then
    raise exception 'Manager can read campaigns';
  end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
  if exists (select 1 from public.marketing_campaign_recipients where tenant_id = '76000000-0000-0000-0000-0000000000a1') then
    raise exception 'Campaign recipients leaked across tenants';
  end if;
end;
$$;

reset role;

do $$
begin
  if (
    select string_agg(r.channel || ':' || c.full_name, ',' order by r.channel, c.full_name)
    from public.marketing_campaign_recipients r
    join public.customers c on c.id = r.customer_id
    join public.marketing_campaigns mc on mc.id = r.campaign_id and mc.name = 'Regreso'
  ) <> 'EMAIL:Uno,GOOGLE:Dos,GOOGLE:Uno' then
    raise exception 'Unexpected campaign recipients';
  end if;
  if not exists (select 1 from public.audit_logs where action = 'MARKETING_CAMPAIGN_CREATED' and tenant_id = '76000000-0000-0000-0000-0000000000a1')
    or not exists (select 1 from public.audit_logs where action = 'TENANT_CAMPAIGNS_UPDATED' and tenant_id = '76000000-0000-0000-0000-0000000000a1') then
    raise exception 'Campaign actions were not audited';
  end if;
end;
$$;
