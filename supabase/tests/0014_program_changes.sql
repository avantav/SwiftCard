\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare update_result text;
begin
  select app.update_loyalty_program(
    (select id from public.loyalty_programs where tenant_id = '10000000-0000-0000-0000-000000000001'),
    'ACTIVE', 'PER_AMOUNT', 0, 1, 10000, true, 10, 'Nueva recompensa', 'Nueva descripción', null
  ) into update_result;
  if update_result <> 'UPDATED' then raise exception 'Admin could not version loyalty rule'; end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
declare result_record record;
begin
  select * into result_record from app.preview_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 25000);
  if result_record.result <> 'PREVIEW' or result_record.stamps_awarded <> 2 then raise exception 'New amount rule was not applied'; end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
do $$
declare update_result text;
begin
  select app.update_loyalty_program(
    (select id from public.loyalty_programs where tenant_id = '10000000-0000-0000-0000-000000000001'),
    'PAUSED', 'PER_AMOUNT', 0, 1, 10000, true, 10, 'Nueva recompensa', 'Nueva descripción', null
  ) into update_result;
  if update_result <> 'UPDATED' then raise exception 'Admin could not pause loyalty program'; end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
do $$
declare result_record record;
begin
  select * into result_record from app.preview_purchase('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 25000);
  if result_record.result <> 'PROGRAM_PAUSED' then raise exception 'Paused program still previewed a purchase'; end if;
end;
$$;
reset role;

select 'Program change assertions passed' as result;
