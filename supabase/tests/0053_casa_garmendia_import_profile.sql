\set ON_ERROR_STOP on

update public.tenants
set name = 'Casa Garmendia'
where id = '10000000-0000-0000-0000-000000000001';

select id as garmendia_card_id, program_id as garmendia_program_id
from public.loyalty_cards
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and status = 'PUBLISHED'
order by published_at
limit 1\gset

select public_registration_token as garmendia_branch_token
from public.branches
where id = '20000000-0000-0000-0000-000000000001'\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select app.save_loyalty_card_program(
  :'garmendia_card_id', 'Puntos Casa Garmendia', 'LIFETIME_POINTS', 'PER_AMOUNT',
  0, 1, 1000, false,
  'Los puntos importados conservan los premios equivalentes del programa anterior.',
  '[
    {"stamps_required":100,"name":"2 bebidas de café","description":"Premio importado","expiration_days":null},
    {"stamps_required":200,"name":"Chilaquiles sin proteína","description":"Premio importado","expiration_days":null},
    {"stamps_required":300,"name":"15% de descuento en un consumo","description":"Premio importado","expiration_days":null},
    {"stamps_required":400,"name":"Alimento + bebida sin alcohol","description":"Premio importado","expiration_days":null},
    {"stamps_required":500,"name":"Bolsa de Café de la Casa","description":"Premio importado","expiration_days":null},
    {"stamps_required":650,"name":"Kit Barista","description":"Premio importado","expiration_days":null},
    {"stamps_required":860,"name":"Cena de 3 tiempos para 2 personas","description":"Premio importado","expiration_days":null}
  ]'::jsonb,
  'punto', 'puntos'
) as garmendia_program_result\gset

select case when :'garmendia_program_result' = 'SAVED' then 1 else 1 / 0 end
  as garmendia_program_saved_assertion;

insert into public.customer_imports (
  id, tenant_id, file_name, file_type, file_size_bytes, status,
  raw_rows, prepared_rows, total_rows, error_rows, uploaded_by,
  mapped_columns, preview_errors, import_profile_code,
  loyalty_card_id, source_branch_id
) values (
  '90000000-0000-0000-0000-000000000053',
  '10000000-0000-0000-0000-000000000001',
  'clientes-casa-garmendia.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  1024, 'PREVIEWED', '[]'::jsonb,
  '[
    {"source_row":2,"full_name":"Cliente Tres Sellos","normalized_phone":"+528100005303","email":"tres@example.com","birth_date":"1990-01-03","legacy_stamps":"3"},
    {"source_row":3,"full_name":"Cliente Quince Sellos","normalized_phone":"+528100005315","email":"quince@example.com","birth_date":"1985-05-15","legacy_stamps":"15"}
  ]'::jsonb,
  2, 0, '00000000-0000-0000-0000-000000000011',
  '{"firstName":"Nombre","lastName":"Apellido","email":"Email","phone":"Teléfono","birthDate":"Fecha de Nacimiento","legacyStamps":"Estampillas Actuales"}'::jsonb,
  '[]'::jsonb, 'CASA_GARMENDIA_LEGACY_STAMPS_2026',
  :'garmendia_card_id', '20000000-0000-0000-0000-000000000001'
);

select app.confirm_casa_garmendia_customer_import(
  '90000000-0000-0000-0000-000000000053'
) as garmendia_import_result\gset

select case when :'garmendia_import_result'::jsonb->>'result' = 'CONFIRMED'
  and (:'garmendia_import_result'::jsonb->>'imported')::integer = 2
  and (:'garmendia_import_result'::jsonb->>'rewards')::integer = 10
  then 1 else 1 / 0 end as garmendia_import_assertion;

do $$
declare
  three_customer_id uuid;
  fifteen_customer_id uuid;
  three_balance bigint;
  fifteen_balance bigint;
  three_rewards integer;
  fifteen_rewards integer;
begin
  select id into three_customer_id from public.customers
  where normalized_phone = '+528100005303';
  select id into fifteen_customer_id from public.customers
  where normalized_phone = '+528100005315';

  select lifetime_points_tenths into three_balance
  from public.customer_loyalty_balances where customer_id = three_customer_id;
  select lifetime_points_tenths into fifteen_balance
  from public.customer_loyalty_balances where customer_id = fifteen_customer_id;
  select count(*) into three_rewards from public.rewards where customer_id = three_customer_id;
  select count(*) into fifteen_rewards from public.rewards where customer_id = fifteen_customer_id;

  if three_balance <> 1000 or fifteen_balance <> 8600
    or three_rewards <> 2 or fifteen_rewards <> 8
    or (select customer_import_id from public.customers where id = three_customer_id)
      <> '90000000-0000-0000-0000-000000000053'::uuid
    or not exists (
      select 1 from public.stamp_ledger
      where customer_id = fifteen_customer_id
        and units_delta_tenths = 8600
        and reason like '%15 sellos anteriores = 860 puntos%'
    ) then
    raise exception 'Casa Garmendia conversion, rewards or import identifier is incorrect';
  end if;
end;
$$;

select app.confirm_casa_garmendia_customer_import(
  '90000000-0000-0000-0000-000000000053'
) as garmendia_second_confirmation\gset

select case when :'garmendia_second_confirmation'::jsonb->>'result' = 'ALREADY_CONFIRMED'
  then 1 else 1 / 0 end as garmendia_single_confirmation_assertion;

reset role;
set role anon;

select result, card_token
from app.register_public_customer(
  :'garmendia_branch_token',
  :'garmendia_card_id', 'Cliente Tres Sellos', '+528100005303',
  'tres@example.com', '1990-01-03', true
)\gset recovered_

select case when :'recovered_result' = 'IMPORTED_RECOVERY'
  and length(:'recovered_card_token') >= 40 then 1 else 1 / 0 end
  as imported_public_recovery_assertion;

select result
from app.register_public_customer(
  :'garmendia_branch_token',
  :'garmendia_card_id', 'Nombre Incorrecto', '+528100005303',
  '', null, true
)\gset wrong_name_

select case when :'wrong_name_result' = 'DUPLICATE' then 1 else 1 / 0 end
  as imported_recovery_name_match_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select repeat_delivery_allowed
from app.get_staff_customer_wallet_delivery(
  (select id from public.customer_cards where public_token = :'recovered_card_token')
)\gset delivery_

select case when :'delivery_repeat_delivery_allowed' = 't' then 1 else 1 / 0 end
  as imported_employee_repeat_delivery_assertion;

select app.confirm_casa_garmendia_customer_import(
  '90000000-0000-0000-0000-000000000053'
) as manager_import_result\gset

select case when :'manager_import_result'::jsonb->>'result' = 'UNAVAILABLE'
  then 1 else 1 / 0 end as manager_import_denied_assertion;

reset role;

do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'CASA_GARMENDIA_CUSTOMERS_IMPORTED'
      and entity_id = '90000000-0000-0000-0000-000000000053'
  ) or not exists (
    select 1 from public.audit_logs
    where action = 'IMPORTED_CUSTOMER_CARD_RECOVERED'
  ) then
    raise exception 'Casa Garmendia import or recovery audit is missing';
  end if;
end;
$$;

select 'Casa Garmendia import profile assertions passed' as result;
