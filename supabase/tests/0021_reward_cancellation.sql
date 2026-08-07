\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare reward_id_value uuid; result_value text; reward_status_value public.reward_status; balance_before integer; balance_after integer;
begin
  select id into reward_id_value from public.rewards where status = 'AVAILABLE' limit 1;
  select stamp_balance into balance_before from public.customer_loyalty_balances where customer_id = (select customer_id from public.rewards where id = reward_id_value);
  select app.cancel_reward(reward_id_value, 'Recompensa inválida') into result_value;
  select status into reward_status_value from public.rewards where id = reward_id_value;
  select stamp_balance into balance_after from public.customer_loyalty_balances where customer_id = (select customer_id from public.rewards where id = reward_id_value);
  if result_value <> 'CANCELLED' or reward_status_value <> 'CANCELLED' or balance_before <> balance_after then raise exception 'Reward cancellation changed incorrect state'; end if;
end;
$$;

do $$
declare result_value text;
begin
  select app.cancel_reward('00000000-0000-0000-0000-000000009999', 'Missing') into result_value;
  if result_value <> 'UNAVAILABLE' then raise exception 'Unknown reward was cancelled'; end if;
end;
$$;
reset role;
select 'Reward cancellation assertions passed' as result;
