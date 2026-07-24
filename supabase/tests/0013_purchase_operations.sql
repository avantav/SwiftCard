\set ON_ERROR_STOP on

insert into public.customers (id, tenant_id, full_name, normalized_phone, privacy_consent, registration_method, source_branch_id, created_by_staff_id)
values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Purchase Customer', '+528199999999', true, 'EMPLOYEE', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
declare result_record record;
begin
  select * into result_record from app.preview_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 15000);
  if result_record.result <> 'PREVIEW' or result_record.stamps_awarded <> 1 then raise exception 'Purchase preview did not calculate per-purchase stamps'; end if;
end;
$$;

do $$
declare result_record record;
begin
  select * into result_record from app.confirm_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'T-001', 15000, null, null);
  if result_record.result <> 'CONFIRMED' or result_record.stamps_awarded <> 1 then raise exception 'Purchase confirmation failed'; end if;
end;
$$;

do $$
declare result_record record;
begin
  select * into result_record from app.confirm_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'T-001', 15000, null, null);
  if result_record.result <> 'DUPLICATE_TICKET' then raise exception 'Duplicate ticket was accepted'; end if;
end;
$$;

reset role;
select 'Purchase operation assertions passed' as result;
