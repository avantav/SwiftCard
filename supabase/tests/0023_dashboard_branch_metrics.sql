\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
select count(*) as manager_branch_count from app.get_dashboard_branch_metrics(null, null)\gset
select 1 / nullif(case when :manager_branch_count = 1 then 1 else 0 end, 0) as manager_scope_assertion;
reset role;

select 'Dashboard branch metric assertions passed' as result;
