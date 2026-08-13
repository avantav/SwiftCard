\set ON_ERROR_STOP on

select public_registration_token as multi_branch_token
from public.branches
where id = '20000000-0000-0000-0000-000000000001'\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select result as first_result, loyalty_card_id as first_card_id
from app.create_loyalty_card_draft('Tarjeta Norte')\gset
select case when :'first_result' = 'CREATED' then 1 else 1 / 0 end
  as first_draft_assertion;
select loyalty_card_id as second_card_id
from app.create_loyalty_card_draft('Tarjeta Centro')
where result = 'CREATED'\gset
select loyalty_card_id as third_card_id
from app.create_loyalty_card_draft('Tarjeta Sur')
where result = 'CREATED'\gset

do $$
declare
  result_value text;
begin
  select result into result_value from app.create_loyalty_card_draft('Tarjeta excedente');
  if result_value <> 'LIMIT_REACHED' then
    raise exception 'Fourth non-archived card was accepted';
  end if;
end;
$$;

select app.save_loyalty_card_program(
  :'first_card_id', 'Tarjeta Norte', 'STAMPS_PER_PURCHASE', 'PER_PURCHASE',
  0, 1, null, true,
  'Consulta los términos y condiciones de Tarjeta Norte.',
  '[{"stamps_required":5,"name":"Bebida gratis","description":"Una bebida de la casa","expiration_days":30}]'::jsonb,
  'sello', 'sellos'
) as program_result\gset
select case when :'program_result' = 'SAVED' then 1 else 1 / 0 end
  as program_stage_assertion;

select app.save_loyalty_card_design(
  :'first_card_id', true, 'Tarjeta Norte', 'Recompensas de Tarjeta Norte',
  '#0F766E', '#FFFFFF', '#FFFFFF', '', ''
) as design_result\gset
select case when :'design_result' = 'SAVED' then 1 else 1 / 0 end
  as design_stage_assertion;

select app.save_loyalty_card_locations(
  :'first_card_id', array['20000000-0000-0000-0000-000000000001'::uuid]
) as locations_result\gset
select case when :'locations_result' = 'SAVED' then 1 else 1 / 0 end
  as locations_stage_assertion;

select app.publish_loyalty_card(:'first_card_id') as publish_result\gset
select case when :'publish_result' = 'PUBLISHED' then 1 else 1 / 0 end
  as publish_assertion;

do $$
declare
  card_count integer;
  published_count integer;
begin
  select count(*), count(*) filter (where status = 'PUBLISHED')
    into card_count, published_count
  from public.loyalty_cards
  where tenant_id = '10000000-0000-0000-0000-000000000001';
  if card_count <> 3 or published_count <> 1 then
    raise exception 'Card draft/publication state mismatch';
  end if;
end;
$$;

reset role;
set role anon;
select result as registration_result, card_token as issued_token
from app.register_public_customer(
  :'multi_branch_token', :'first_card_id', 'Cliente Multitarjeta',
  '+528199998888', 'multi@example.com', null, true
)\gset multi_
select case when :'multi_registration_result' = 'CREATED' then 1 else 1 / 0 end
  as registration_assertion;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
select result, customer_card_id, loyalty_card_id
from app.resolve_staff_card_scan(:'multi_issued_token')\gset scan_
select case when :'scan_result' = 'FOUND'
  and :'scan_loyalty_card_id' = :'first_card_id' then 1 else 1 / 0 end
  as scan_assertion;

select result as purchase_result, stamps_awarded
from app.confirm_card_purchase(
  :'scan_customer_card_id',
  '20000000-0000-0000-0000-000000000001',
  'MULTI-CARD-001',
  10000,
  null,
  null
)\gset purchase_
select case when :'purchase_purchase_result' = 'CONFIRMED'
  and :'purchase_stamps_awarded' = '1' then 1 else 1 / 0 end
  as purchase_assertion;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
do $$
declare visible_count integer;
begin
  select count(*) into visible_count
  from public.loyalty_cards
  where tenant_id = '10000000-0000-0000-0000-000000000001';
  if visible_count <> 0 then raise exception 'Cross-tenant card read was allowed'; end if;
end;
$$;
reset role;

select 'Multi-card draft and operation assertions passed' as result;
