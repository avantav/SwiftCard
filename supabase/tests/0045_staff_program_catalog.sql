\set ON_ERROR_STOP on

select issued.id as employee_customer_card_id
from public.customer_cards issued
join public.customers customer on customer.id = issued.customer_id
where customer.full_name = 'Cliente Multitarjeta'
limit 1\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select loyalty_card_id as employee_catalog_card_id
from app.get_staff_program_catalog()
where card_name = 'Tarjeta Norte'
  and terms_and_conditions like '%Tarjeta Norte%'
  and jsonb_array_length(reward_tiers) = 1
limit 1\gset

select case when :'employee_catalog_card_id' <> '' then 1 else 1 / 0 end
  as employee_catalog_assertion;

select count(*) as employee_customer_summary_count
from app.get_staff_customer_card_summary(:'employee_customer_card_id')
where customer_name = 'Cliente Multitarjeta'\gset

select case when :'employee_customer_summary_count' = '1' then 1 else 1 / 0 end
  as employee_customer_summary_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

select count(*) as cross_tenant_catalog_count
from app.get_staff_program_catalog()
where loyalty_card_id = :'employee_catalog_card_id'::uuid\gset

select case when :'cross_tenant_catalog_count' = '0' then 1 else 1 / 0 end
  as cross_tenant_catalog_assertion;

select count(*) as cross_tenant_customer_summary_count
from app.get_staff_customer_card_summary(:'employee_customer_card_id')\gset

select case when :'cross_tenant_customer_summary_count' = '0' then 1 else 1 / 0 end
  as cross_tenant_customer_summary_assertion;

reset role;
set role anon;

do $$
begin
  begin
    perform 1 from app.get_staff_program_catalog();
    raise exception 'Anonymous role executed the staff program catalog';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    perform 1 from app.get_staff_customer_card_summary(
      '00000000-0000-0000-0000-000000000000'::uuid
    );
    raise exception 'Anonymous role executed the staff customer summary';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'Staff program catalog assertions passed' as result;
