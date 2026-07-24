\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare purchase_id_value uuid; result_value text; purchase_status_value public.purchase_status; balance_value integer;
begin
  select id into purchase_id_value from public.purchases where ticket_number = 'T-001';
  select app.cancel_purchase(purchase_id_value, 'Corrección administrativa') into result_value;
  if result_value <> 'CANCELLED' then raise exception 'Purchase was not cancelled'; end if;
  select status into purchase_status_value from public.purchases where id = purchase_id_value;
  select stamp_balance into balance_value from public.customer_loyalty_balances where customer_id = '30000000-0000-0000-0000-000000000003';
  if purchase_status_value <> 'CANCELLED' or balance_value <> 0 then raise exception 'Cancellation did not restore purchase balance'; end if;
  select app.cancel_purchase(purchase_id_value, 'Second attempt') into result_value;
  if result_value <> 'UNAVAILABLE' then raise exception 'Cancelled purchase was cancelled twice'; end if;
end;
$$;
reset role;
select 'Purchase cancellation assertions passed' as result;
