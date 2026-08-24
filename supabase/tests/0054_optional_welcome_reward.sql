\set ON_ERROR_STOP on

select id as welcome_card_id
from public.loyalty_cards
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and status = 'PUBLISHED'
order by published_at
limit 1\gset

select public_registration_token as welcome_branch_token
from public.branches
where id = '20000000-0000-0000-0000-000000000001'\gset

select jsonb_agg(jsonb_build_object(
  'stamps_required', tier.stamps_required,
  'name', tier.name,
  'description', tier.description,
  'expiration_days', tier.expiration_days
) order by tier.stamps_required)::text as welcome_tiers
from public.loyalty_reward_tiers tier
join public.loyalty_cards card on card.program_id = tier.program_id
where card.id = :'welcome_card_id'
  and tier.active\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select app.save_loyalty_card_program(
  :'welcome_card_id', 'Puntos con bienvenida', 'LIFETIME_POINTS', 'PER_AMOUNT',
  0, 1, 1000, false,
  'Los clientes nuevos reciben un regalo de bienvenida opcional.',
  :'welcome_tiers'::jsonb,
  'punto', 'puntos',
  true, 'Bebida de bienvenida', 'Beneficio único por registrarte.', 30
) as welcome_save_result\gset

select case when :'welcome_save_result' = 'SAVED' then 1 else 1 / 0 end
  as welcome_configuration_saved_assertion;

reset role;
set role anon;

select result, card_token
from app.register_public_customer(
  :'welcome_branch_token', :'welcome_card_id',
  'Cliente Bienvenida Pública', '+528100005401',
  'bienvenida-publica@example.com', '1992-05-04', true
)\gset public_welcome_

select case when :'public_welcome_result' = 'CREATED'
  and length(:'public_welcome_card_token') >= 40
  then 1 else 1 / 0 end as public_welcome_registration_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select result, card_token
from app.register_employee_customer(
  '20000000-0000-0000-0000-000000000001', :'welcome_card_id',
  'Cliente Bienvenida Empleado', '+528100005402',
  'bienvenida-empleado@example.com', '1993-06-05', true
)\gset employee_welcome_

select case when :'employee_welcome_result' = 'CREATED'
  and length(:'employee_welcome_card_token') >= 40
  then 1 else 1 / 0 end as employee_welcome_registration_assertion;

reset role;

do $$
declare
  public_customer_id uuid;
  employee_customer_id uuid;
begin
  select id into public_customer_id from public.customers
  where normalized_phone = '+528100005401';
  select id into employee_customer_id from public.customers
  where normalized_phone = '+528100005402';

  if (select count(*) from public.rewards
      where customer_id = public_customer_id
        and is_welcome_reward
        and name = 'Bebida de bienvenida'
        and status = 'AVAILABLE') <> 1
    or (select count(*) from public.rewards
      where customer_id = employee_customer_id
        and is_welcome_reward
        and name = 'Bebida de bienvenida'
        and status = 'AVAILABLE') <> 1
    or not exists (
      select 1 from public.rewards
      where customer_id = public_customer_id
        and is_welcome_reward
        and stamps_required_snapshot = 0
        and expires_at between now() + interval '29 days'
          and now() + interval '31 days'
    ) then
    raise exception 'Welcome reward was not granted once to both registration paths';
  end if;

  begin
    insert into public.rewards (
      tenant_id, customer_id, program_id, name, description,
      loyalty_card_id, is_welcome_reward
    )
    select issued.tenant_id, public_customer_id, card.program_id,
      'Duplicado', '', issued.loyalty_card_id, true
    from public.customer_cards issued
    join public.loyalty_cards card on card.id = issued.loyalty_card_id
    where issued.customer_id = public_customer_id;
    raise exception 'Duplicate welcome reward was accepted';
  exception when unique_violation then
    null;
  end;
end;
$$;

set role anon;

select result
from app.register_public_customer(
  :'welcome_branch_token', :'welcome_card_id',
  'Cliente Tres Sellos', '+528100005303',
  'tres@example.com', '1990-01-03', true
)\gset recovered_welcome_

reset role;

select case when :'recovered_welcome_result' = 'IMPORTED_RECOVERY'
  then 1 else 1 / 0 end as imported_recovery_preserved_assertion;

do $$
begin
  if exists (
    select 1 from public.rewards reward
    join public.customers customer on customer.id = reward.customer_id
    where customer.normalized_phone = '+528100005303'
      and reward.is_welcome_reward
  ) then
    raise exception 'Imported recovery received a duplicate welcome reward';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select app.save_loyalty_card_program(
  :'welcome_card_id', 'Puntos sin bienvenida', 'LIFETIME_POINTS', 'PER_AMOUNT',
  0, 1, 1000, false,
  'El regalo de bienvenida puede permanecer desactivado.',
  :'welcome_tiers'::jsonb,
  'punto', 'puntos',
  false, null, null, null
) as welcome_disable_result\gset

select case when :'welcome_disable_result' = 'SAVED' then 1 else 1 / 0 end
  as welcome_disabled_assertion;

reset role;
set role anon;

select result
from app.register_public_customer(
  :'welcome_branch_token', :'welcome_card_id',
  'Cliente Sin Bienvenida', '+528100005403',
  'sin-bienvenida@example.com', '1994-07-06', true
)\gset no_welcome_

reset role;

select case when :'no_welcome_result' = 'CREATED'
  then 1 else 1 / 0 end as optional_welcome_registration_assertion;

do $$
begin
  if exists (
    select 1 from public.rewards reward
    join public.customers customer on customer.id = reward.customer_id
    where customer.normalized_phone = '+528100005403'
      and reward.is_welcome_reward
  ) then
    raise exception 'Disabled welcome reward was granted';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'LOYALTY_CARD_WELCOME_REWARD_CONFIGURED'
  ) then
    raise exception 'Welcome reward configuration audit is missing';
  end if;
end;
$$;

select 'Optional welcome reward assertions passed' as result;
