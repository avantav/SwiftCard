\set ON_ERROR_STOP on

insert into public.loyalty_programs (
  tenant_id, name, rule_type, minimum_purchase_minor, stamps_per_purchase,
  reward_stamp_goal, reward_name
) values (
  '10000000-0000-0000-0000-000000000001', 'Programa A', 'PER_PURCHASE', 10000, 1, 10, 'Recompensa A'
);

do $$
begin
  begin
    insert into public.loyalty_programs (
      tenant_id, name, rule_type, amount_per_stamp_minor, reward_stamp_goal, reward_name
    ) values (
      '10000000-0000-0000-0000-000000000001', 'Programa duplicado', 'PER_AMOUNT', 10000, 10, 'Duplicada'
    );
    raise exception 'Second active loyalty program was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

insert into public.customer_loyalty_balances (tenant_id, customer_id)
values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

do $$
begin
  begin
    insert into public.customer_loyalty_balances (tenant_id, customer_id, stamp_balance)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', -1);
    raise exception 'Negative loyalty balance was accepted';
  exception when check_violation then null;
  end;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.loyalty_programs;
  if visible_count <> 1 then raise exception 'Tenant Admin cannot see own loyalty program'; end if;
end;
$$;
reset role;

select 'Loyalty schema assertions passed' as result;
