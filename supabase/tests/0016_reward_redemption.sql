\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
declare reward_id_value uuid; result_record record;
begin
  select id into reward_id_value from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000004' and status = 'AVAILABLE' limit 1;
  select * into result_record from app.redeem_reward(reward_id_value, '20000000-0000-0000-0000-000000000001', null, null);
  if result_record.result <> 'REDEEMED' then raise exception 'Available reward was not redeemed'; end if;
  select * into result_record from app.redeem_reward(reward_id_value, '20000000-0000-0000-0000-000000000001', null, null);
  if result_record.result <> 'UNAVAILABLE' then raise exception 'Reward was redeemed twice'; end if;
end;
$$;

do $$
declare result_record record;
begin
  select * into result_record from app.redeem_reward('00000000-0000-0000-0000-000000009999', '20000000-0000-0000-0000-000000000001', null, null);
  if result_record.result <> 'UNAVAILABLE' then raise exception 'Unknown reward was redeemed'; end if;
end;
$$;
reset role;
select 'Reward redemption assertions passed' as result;
