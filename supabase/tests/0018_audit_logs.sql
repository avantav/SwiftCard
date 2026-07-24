\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select app.update_customer_profile(
  '30000000-0000-0000-0000-000000000003', 'Audited Customer', '+528199999997', '', null, 'ACTIVE'
);

do $$
declare audit_count integer;
begin
  select count(*) into audit_count
  from public.audit_logs
  where entity_type = 'customers'
    and entity_id = '30000000-0000-0000-0000-000000000003'
    and action = 'CUSTOMER_UPDATED'
    and actor_staff_id = '00000000-0000-0000-0000-000000000011';
  if audit_count <> 1 then raise exception 'Customer update was not audited'; end if;
end;
$$;

do $$
begin
  begin
    delete from public.audit_logs;
    raise exception 'Audit log deletion was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select 'Audit log assertions passed' as result;
