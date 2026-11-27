\set ON_ERROR_STOP on

-- Disable reward cancellation and redemption reversal on the programs of an
-- available reward and of a completed redemption of the fixture Admin
-- (…0011), check both are refused, then restore the flags.
create temporary table correction_fixture as
select
  (select reward.id from public.rewards reward
     join public.loyalty_programs program on program.id = reward.program_id
     where reward.status = 'AVAILABLE'
       and program.program_type <> 'LIFETIME_POINTS'
       and reward.tenant_id = (select tenant_id from public.staff_profiles where id = '00000000-0000-0000-0000-000000000011')
       and (reward.expires_at is null or reward.expires_at > now())
     limit 1) as reward_id,
  (select redemption.id from public.reward_redemptions redemption
     join public.rewards reward on reward.id = redemption.reward_id
     where redemption.status = 'COMPLETED'
       and redemption.tenant_id = (select tenant_id from public.staff_profiles where id = '00000000-0000-0000-0000-000000000011')
     limit 1) as redemption_id;

grant select on correction_fixture to authenticated;

do $$
begin
  if (select reward_id from correction_fixture) is null then
    -- Make one available reward for the fixture tenant from an existing one.
    insert into public.rewards (tenant_id, customer_id, program_id, name, description, status, loyalty_card_id)
    select reward.tenant_id, reward.customer_id, reward.program_id, 'Premio de prueba 0081', '', 'AVAILABLE', reward.loyalty_card_id
    from public.rewards reward
    join public.loyalty_programs program on program.id = reward.program_id
    where program.program_type <> 'LIFETIME_POINTS'
      and reward.tenant_id = (select tenant_id from public.staff_profiles where id = '00000000-0000-0000-0000-000000000011')
    limit 1;
    update correction_fixture set reward_id = (select id from public.rewards where name = 'Premio de prueba 0081' limit 1);
  end if;
  if (select reward_id from correction_fixture) is null then
    raise exception 'Fixture tenant has no non-lifetime reward to test with';
  end if;
  if (select redemption_id from correction_fixture) is null then
    -- A redeemed reward with its completed redemption, as the redeem flow leaves them.
    insert into public.rewards (tenant_id, customer_id, program_id, name, description, status, redeemed_at, loyalty_card_id)
    select reward.tenant_id, reward.customer_id, reward.program_id, 'Premio canjeado 0081', '', 'REDEEMED', now(), reward.loyalty_card_id
    from public.rewards reward
    where reward.id = (select reward_id from correction_fixture);
    insert into public.reward_redemptions (tenant_id, reward_id, customer_id, branch_id, staff_profile_id)
    select reward.tenant_id, reward.id, reward.customer_id,
      (select branch.id from public.branches branch where branch.tenant_id = reward.tenant_id order by branch.created_at limit 1),
      '00000000-0000-0000-0000-000000000011'
    from public.rewards reward
    where reward.name = 'Premio canjeado 0081';
    update correction_fixture set redemption_id = (
      select redemption.id from public.reward_redemptions redemption
      join public.rewards reward on reward.id = redemption.reward_id
      where reward.name = 'Premio canjeado 0081'
    );
  end if;
end;
$$;

update public.loyalty_programs
set allow_reward_cancellations = false
where id = (select program_id from public.rewards where id = (select reward_id from correction_fixture));

update public.loyalty_programs
set allow_redemption_reversals = false
where id = (
  select reward.program_id from public.reward_redemptions redemption
  join public.rewards reward on reward.id = redemption.reward_id
  where redemption.id = (select redemption_id from correction_fixture)
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_value text;
  redemption uuid := (select redemption_id from correction_fixture);
begin
  select app.cancel_reward((select reward_id from correction_fixture), 'Opción desactivada') into result_value;
  if result_value <> 'DISABLED' then
    raise exception 'Disabled reward cancellation returned %', result_value;
  end if;
  if (select status from public.rewards where id = (select reward_id from correction_fixture)) <> 'AVAILABLE' then
    raise exception 'Disabled reward cancellation changed the reward';
  end if;

  if redemption is null then raise exception 'NO_REDEMPTION_FIXTURE'; end if;
  if redemption is not null then
    begin
      perform app.reverse_reward_redemption(redemption, 'Opción desactivada');
      raise exception 'Disabled redemption reversal was applied';
    exception when check_violation then
      null;
    end;
    if (select status from public.reward_redemptions where id = redemption) <> 'COMPLETED' then
      raise exception 'Disabled redemption reversal changed the redemption';
    end if;
  end if;
end;
$$;

reset role;

update public.loyalty_programs
set allow_reward_cancellations = true
where id = (select program_id from public.rewards where id = (select reward_id from correction_fixture))
  and program_type <> 'LIFETIME_POINTS';

update public.loyalty_programs
set allow_redemption_reversals = true
where id = (
  select reward.program_id from public.reward_redemptions redemption
  join public.rewards reward on reward.id = redemption.reward_id
  where redemption.id = (select redemption_id from correction_fixture)
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare result_value text;
begin
  select app.cancel_reward((select reward_id from correction_fixture), 'Opción activa') into result_value;
  if result_value <> 'CANCELLED' then
    raise exception 'Enabled reward cancellation returned %', result_value;
  end if;
end;
$$;

reset role;
drop table correction_fixture;
