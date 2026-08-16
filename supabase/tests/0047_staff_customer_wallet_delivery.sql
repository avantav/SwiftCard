\set ON_ERROR_STOP on

select issued.id as delivery_customer_card_id,
       issued.public_token as delivery_card_token,
       issued.tenant_id as delivery_tenant_id,
       issued.customer_id as delivery_customer_id
from public.customer_cards issued
join public.customers customer on customer.id = issued.customer_id
where customer.full_name = 'Cliente Multitarjeta'
limit 1\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select count(*) as pending_delivery_count
from app.get_staff_customer_wallet_delivery(:'delivery_customer_card_id')
where card_token = :'delivery_card_token'
  and not apple_wallet_added\gset

select case when :'pending_delivery_count' = '1' then 1 else 1 / 0 end
  as pending_delivery_assertion;

reset role;

insert into public.wallet_passes (
  tenant_id,
  customer_id,
  customer_card_id,
  provider,
  status,
  serial_number,
  last_synced_at
) values (
  :'delivery_tenant_id'::uuid,
  :'delivery_customer_id'::uuid,
  :'delivery_customer_card_id'::uuid,
  'APPLE',
  'ACTIVE',
  'delivery-' || :'delivery_customer_card_id',
  now()
)
on conflict (provider, customer_card_id) do update
set status = 'ACTIVE',
    serial_number = excluded.serial_number,
    last_error = null;

select app.register_apple_wallet_device(
  'delivery-' || :'delivery_customer_card_id',
  repeat('d', 64),
  repeat('e', 64),
  'v1.delivery.encrypted-push-token'
) as delivery_registration_result\gset

select case when :'delivery_registration_result' in ('CREATED', 'UPDATED') then 1 else 1 / 0 end
  as delivery_registration_assertion;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select count(*) as completed_delivery_count
from app.get_staff_customer_wallet_delivery(:'delivery_customer_card_id')
where card_token = :'delivery_card_token'
  and apple_wallet_added\gset

select case when :'completed_delivery_count' = '1' then 1 else 1 / 0 end
  as completed_delivery_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

select count(*) as cross_tenant_delivery_count
from app.get_staff_customer_wallet_delivery(:'delivery_customer_card_id')\gset

select case when :'cross_tenant_delivery_count' = '0' then 1 else 1 / 0 end
  as cross_tenant_delivery_assertion;

reset role;
set role anon;

do $$
begin
  begin
    perform 1 from app.get_staff_customer_wallet_delivery(
      '00000000-0000-0000-0000-000000000000'::uuid
    );
    raise exception 'Anonymous role executed the staff Wallet delivery projection';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'Staff customer Wallet delivery assertions passed' as result;
