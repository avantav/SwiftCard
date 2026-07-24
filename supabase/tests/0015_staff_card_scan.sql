\set ON_ERROR_STOP on

insert into public.customer_cards (tenant_id, customer_id)
values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003');
select public_token as scan_token from public.customer_cards where customer_id = '30000000-0000-0000-0000-000000000003'\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
select result, customer_id as found_customer_id from app.resolve_staff_card_scan(:'scan_token')\gset found_
select 1 / nullif(case when :'found_result' = 'FOUND' and :'found_found_customer_id' = '30000000-0000-0000-0000-000000000003' then 1 else 0 end, 0) as found_assertion;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
select result as denied_result from app.resolve_staff_card_scan(:'scan_token')\gset denied_
select 1 / nullif(case when :'denied_denied_result' = 'NOT_THIS_TENANT' then 1 else 0 end, 0) as denied_assertion;
reset role;

select 'Staff scan assertions passed' as result;
