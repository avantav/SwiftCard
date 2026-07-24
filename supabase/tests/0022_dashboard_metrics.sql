\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
select * from app.get_dashboard_metrics(null, null, null)\gset admin_
select 1 / nullif(case when :'admin_customer_count'::bigint >= 1 then 1 else 0 end, 0) as admin_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
select * from app.get_dashboard_metrics('20000000-0000-0000-0000-000000000001', null, null)\gset manager_
select 1 / nullif(case when :'manager_customer_count'::bigint >= 0 then 1 else 0 end, 0) as manager_assertion;
reset role;

select 'Dashboard metrics assertions passed' as result;
