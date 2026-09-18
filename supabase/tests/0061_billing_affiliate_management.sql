\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  result_value text;
  affiliate_id_value uuid;
begin
  select result, affiliate_id into result_value, affiliate_id_value
  from app.create_billing_affiliate(
    'partner-15', 'Partner 15', ' PARTNER@EXAMPLE.COM ', 'PERCENT',
    1500, null, null, 45
  );
  if result_value <> 'CREATED' or affiliate_id_value is null then
    raise exception 'Superadmin could not create an affiliate through the RPC';
  end if;
  if (select contact_email from public.billing_affiliates where id = affiliate_id_value) <> 'partner@example.com' then
    raise exception 'Affiliate contact email was not normalized';
  end if;
  if app.set_billing_affiliate_status(affiliate_id_value, 'ACTIVE') <> 'ACTIVATED' then
    raise exception 'Superadmin could not activate an affiliate';
  end if;
  if app.set_billing_affiliate_status(affiliate_id_value, 'ARCHIVED') <> 'ARCHIVED' then
    raise exception 'Superadmin could not archive an affiliate';
  end if;

  begin
    insert into public.billing_affiliates (
      code, display_name, commission_type, commission_basis_points
    ) values ('DIRECT-AFFILIATE', 'Direct affiliate', 'PERCENT', 1000);
    raise exception 'Superadmin bypassed the affiliate RPC';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  if (select result from app.create_billing_affiliate(
    'forbidden-affiliate', 'Forbidden affiliate', null, 'PERCENT',
    1000, null, null, 30
  )) <> 'UNAVAILABLE' then
    raise exception 'Tenant Admin created an affiliate through the RPC';
  end if;
end;
$$;

reset role;
select 'Billing affiliate management assertions passed' as result;
