\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  result_value text;
  promotion_id_value uuid;
begin
  select result, promotion_id into result_value, promotion_id_value
  from app.create_billing_promotion(
    'pilot-25', 'Piloto 25', 'Promoción creada por RPC', 'PERCENT', 2500,
    null, null, 'REPEATING', 3, now(), now() + interval '30 days',
    20, 1, 500, array['b1000000-0000-0000-0000-000000000001'::uuid]
  );
  if result_value <> 'CREATED' or promotion_id_value is null then
    raise exception 'Superadmin could not create a promotion atomically';
  end if;
  if (select count(*) from public.billing_promotion_packages where promotion_id = promotion_id_value) <> 1 then
    raise exception 'Promotion package eligibility was not created atomically';
  end if;
  if app.set_billing_promotion_status(promotion_id_value, 'ACTIVE') <> 'ACTIVATED' then
    raise exception 'Superadmin could not activate a valid promotion';
  end if;
  if app.set_billing_promotion_status(promotion_id_value, 'ARCHIVED') <> 'ARCHIVED' then
    raise exception 'Superadmin could not archive a promotion';
  end if;

  begin
    insert into public.billing_promotions (
      code, name, discount_type, percent_off_basis_points
    ) values ('DIRECT-WRITE', 'Direct write', 'PERCENT', 1000);
    raise exception 'Superadmin bypassed the atomic promotion RPC';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  if (select result from app.create_billing_promotion(
    'forbidden-promo', 'Forbidden promo', '', 'PERCENT', 1000, null, null,
    'ONCE', null, null, null, 10, 1, 100,
    array['b1000000-0000-0000-0000-000000000001'::uuid]
  )) <> 'UNAVAILABLE' then
    raise exception 'Tenant Admin created a promotion through the RPC';
  end if;
end;
$$;

reset role;
select 'Billing promotion management assertions passed' as result;
