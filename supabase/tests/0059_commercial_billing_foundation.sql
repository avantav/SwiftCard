\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  result_value text;
  package_id_value uuid;
begin
  select result, package_id into result_value, package_id_value
  from app.create_billing_package(
    'growth-draft', 'Growth draft', 'Paquete creado por RPC', 2500, 5, 3,
    '{"analytics":true}'::jsonb, 'mxn', 'MONTH', 199000
  );
  if result_value <> 'CREATED' or package_id_value is null then
    raise exception 'Superadmin could not create an atomic package and price';
  end if;
  if app.set_billing_package_status(package_id_value, 'ARCHIVED') <> 'ARCHIVED' then
    raise exception 'Superadmin could not archive a package and its price';
  end if;
  if exists (
    select 1 from public.billing_package_prices
    where package_id = package_id_value and status <> 'ARCHIVED'
  ) then
    raise exception 'Package price was not archived atomically';
  end if;
end;
$$;

reset role;

insert into public.billing_packages (
  id, code, name, description, status, membership_limit,
  branch_limit, loyalty_card_limit, entitlements,
  created_by_staff_id, updated_by_staff_id
) values (
  'b1000000-0000-0000-0000-000000000001', 'starter', 'Starter',
  'Paquete inicial verificable', 'ACTIVE', 500, 1, 1,
  '{"wallet_apple":true,"wallet_google":true}'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.billing_package_prices (
  id, package_id, currency_code, billing_interval, amount_minor, status,
  stripe_product_id, stripe_price_id, created_by_staff_id, updated_by_staff_id
) values (
  'b2000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'MXN', 'MONTH', 99000, 'ACTIVE', 'prod_TestStarter', 'price_TestStarterMonthly',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.billing_promotions (
  id, code, name, status, discount_type, percent_off_basis_points,
  duration, max_redemptions, max_redemptions_per_tenant,
  membership_coverage_limit, created_by_staff_id, updated_by_staff_id
) values (
  'b3000000-0000-0000-0000-000000000001', 'LANZAMIENTO20',
  'Lanzamiento 20', 'ACTIVE', 'PERCENT', 2000, 'ONCE', 100, 1, 500,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.billing_promotion_packages (promotion_id, package_id)
values (
  'b3000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001'
);

insert into public.billing_affiliates (
  id, code, display_name, contact_email, status, commission_type,
  commission_basis_points, attribution_window_days,
  created_by_staff_id, updated_by_staff_id
) values (
  'b4000000-0000-0000-0000-000000000001', 'SOCIO10', 'Socio de prueba',
  'socio@example.test', 'ACTIVE', 'PERCENT', 1000, 30,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.billing_customers (
  id, tenant_id, stripe_customer_id, billing_email
) values (
  'b5000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'cus_TestTenantA', 'billing-a@example.test'
);

insert into public.tenant_subscriptions (
  id, tenant_id, billing_customer_id, package_id, package_price_id,
  status, billing_interval, currency_code, amount_minor,
  package_code_snapshot, package_name_snapshot, membership_limit_snapshot,
  branch_limit_snapshot, loyalty_card_limit_snapshot, entitlements_snapshot,
  current_period_start, current_period_end, stripe_subscription_id,
  created_by_staff_id, updated_by_staff_id
) values (
  'b6000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  'ACTIVE', 'MONTH', 'MXN', 99000, 'starter', 'Starter', 500, 1, 1,
  '{"wallet_apple":true,"wallet_google":true}'::jsonb,
  date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
  'sub_TestTenantA',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.billing_affiliate_referrals (
  id, tenant_id, affiliate_id, attributed_code_snapshot, converted_at
) values (
  'b7000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001', 'SOCIO10', now()
);

insert into public.billing_promotion_redemptions (
  id, tenant_id, subscription_id, promotion_id, affiliate_referral_id,
  promotion_code_snapshot, discount_type_snapshot,
  percent_off_basis_points_snapshot, covered_memberships
) values (
  'b8000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'b6000000-0000-0000-0000-000000000001',
  'b3000000-0000-0000-0000-000000000001',
  'b7000000-0000-0000-0000-000000000001',
  'LANZAMIENTO20', 'PERCENT', 2000, 500
);

insert into public.billing_affiliate_commissions (
  id, tenant_id, affiliate_id, referral_id, subscription_id,
  stripe_invoice_id, gross_amount_minor, commission_amount_minor,
  currency_code, status, approved_at
) values (
  'b9000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001',
  'b7000000-0000-0000-0000-000000000001',
  'b6000000-0000-0000-0000-000000000001',
  'in_TestTenantA', 99000, 9900, 'MXN', 'APPROVED', now()
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  usage_before integer;
  usage_after integer;
  peak_after integer;
  published_card_id uuid;
begin
  select current_memberships into usage_before
  from public.billing_membership_usage
  where subscription_id = 'b6000000-0000-0000-0000-000000000001';

  select id into published_card_id
  from public.loyalty_cards
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and status = 'PUBLISHED'
  order by published_at
  limit 1;

  insert into public.customers (
    id, tenant_id, full_name, normalized_phone, privacy_consent,
    registration_method, source_branch_id
  ) values (
    '30000000-0000-0000-0000-000000000159',
    '10000000-0000-0000-0000-000000000001',
    'Miembro facturable', '+528100000159', true, 'SELF_SERVICE',
    '20000000-0000-0000-0000-000000000001'
  );

  insert into public.customer_cards (
    id, tenant_id, customer_id, loyalty_card_id
  ) values (
    'ca000000-0000-0000-0000-000000000159',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000159', published_card_id
  );

  select current_memberships, peak_memberships into usage_after, peak_after
  from public.billing_membership_usage
  where subscription_id = 'b6000000-0000-0000-0000-000000000001';

  if usage_after <> usage_before + 1 or peak_after <> usage_before + 1 then
    raise exception 'Membership issuance did not update current and peak usage';
  end if;

  update public.customers set status = 'INACTIVE'
  where id = '30000000-0000-0000-0000-000000000159';

  select current_memberships, peak_memberships into usage_after, peak_after
  from public.billing_membership_usage
  where subscription_id = 'b6000000-0000-0000-0000-000000000001';

  if usage_after <> usage_before or peak_after <> usage_before + 1 then
    raise exception 'Membership high-water mark was not preserved';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  if (select count(*) from public.tenant_subscriptions) <> 1 then
    raise exception 'Tenant Admin cannot read its subscription';
  end if;
  if (select count(*) from public.billing_membership_usage) <> 1 then
    raise exception 'Tenant Admin cannot read its membership usage';
  end if;
  if (select count(*) from public.billing_affiliate_referrals) <> 1 then
    raise exception 'Tenant Admin cannot read its referral attribution';
  end if;
  if (select count(*) from public.billing_affiliate_commissions) <> 1 then
    raise exception 'Tenant Admin cannot read its commission record';
  end if;
  if (select count(*) from public.billing_affiliates) <> 0 then
    raise exception 'Tenant Admin can read the private affiliate catalog';
  end if;

  begin
    insert into public.billing_packages (code, name, status)
    values ('forbidden', 'Forbidden', 'ACTIVE');
    raise exception 'Tenant Admin created a global package';
  exception when insufficient_privilege then
    null;
  end;

  if (select result from app.create_billing_package(
    'forbidden-rpc', 'Forbidden RPC', '', 10, 1, 1, '{}'::jsonb,
    'MXN', 'MONTH', 1000
  )) <> 'UNAVAILABLE' then
    raise exception 'Tenant Admin created a package through the RPC';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
begin
  if (select count(*) from public.tenant_subscriptions) <> 0
    or (select count(*) from public.billing_membership_usage) <> 0
    or (select count(*) from public.billing_promotion_redemptions) <> 0
    or (select count(*) from public.billing_affiliate_referrals) <> 0
    or (select count(*) from public.billing_affiliate_commissions) <> 0 then
    raise exception 'Cross-tenant commercial records are visible';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
begin
  if (select count(*) from public.billing_packages) <> 0
    or (select count(*) from public.tenant_subscriptions) <> 0 then
    raise exception 'Branch Administrator can read commercial data';
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'BILLING_PACKAGES_INSERT'
      and entity_id = 'b1000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Commercial package creation was not audited';
  end if;
end;
$$;

select 'Commercial billing foundation assertions passed' as result;
