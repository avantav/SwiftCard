\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare redemption_id_value uuid; result_value text; reward_status_value public.reward_status;
begin
  select id into redemption_id_value from public.reward_redemptions where status = 'COMPLETED' limit 1;
  select app.reverse_reward_redemption(redemption_id_value, 'Corrección de canje') into result_value;
  if result_value <> 'REVERSED' then raise exception 'Redemption was not reversed'; end if;
  select r.status into reward_status_value from public.rewards r join public.reward_redemptions rr on rr.reward_id = r.id where rr.id = redemption_id_value;
  if reward_status_value <> 'AVAILABLE' then raise exception 'Reversed reward was not made available'; end if;
end;
$$;

do $$
declare result_value text; balance_value integer;
begin
  select app.adjust_customer_stamps('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 3, 'Compensación') into result_value;
  if result_value <> 'ADJUSTED' then raise exception 'Positive adjustment failed'; end if;
  select app.adjust_customer_stamps('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', -5, 'Exceso') into result_value;
  if result_value <> 'NEGATIVE_BALANCE' then raise exception 'Negative adjustment was accepted'; end if;
  select stamp_balance into balance_value from public.customer_loyalty_balances where customer_id = '30000000-0000-0000-0000-000000000003';
  if balance_value <> 3 then raise exception 'Failed adjustment changed balance'; end if;
end;
$$;
reset role;
select 'Reversal and adjustment assertions passed' as result;
