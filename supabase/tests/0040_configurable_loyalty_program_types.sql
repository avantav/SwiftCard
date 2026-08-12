\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000071', 'program-options@swiftwallet.test');

insert into public.tenants (id, name, status)
values ('10000000-0000-0000-0000-000000000007', 'Tenant Program Options', 'ACTIVE');

insert into public.staff_profiles (
  id,
  tenant_id,
  email,
  full_name,
  role,
  status
)
values (
  '00000000-0000-0000-0000-000000000071',
  '10000000-0000-0000-0000-000000000007',
  'program-options@swiftwallet.test',
  'Program Options Admin',
  'ADMIN',
  'ACTIVE'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000071', false);

do $$
declare
  save_record record;
  program_record record;
  audit_count integer;
begin
  select * into save_record
  from app.save_loyalty_program_configuration(
    null,
    'Puntos acumulativos',
    'PAUSED',
    'LIFETIME_POINTS',
    'PER_AMOUNT',
    0,
    1,
    1000,
    false,
    'Los puntos no se reinician y cada recompensa se entrega una sola vez.',
    '[
      {"stamps_required": 100, "name": "Café", "description": "Dos bebidas de café", "expiration_days": null},
      {"stamps_required": 200, "name": "Chilaquiles", "description": "Chilaquiles sin proteína", "expiration_days": 30}
    ]'::jsonb,
    'punto',
    'puntos',
    true,
    'Churro individual',
    'Beneficio único de registro',
    30,
    true,
    10,
    false,
    false,
    true
  );

  select * into program_record
  from public.loyalty_programs
  where id = save_record.saved_program_id;

  select count(*) into audit_count
  from public.audit_logs
  where entity_id = save_record.saved_program_id
    and action = 'LOYALTY_PROGRAM_OPTIONS_CONFIGURED';

  if save_record.result <> 'CREATED'
    or program_record.program_type <> 'LIFETIME_POINTS'
    or program_record.rule_type <> 'PER_AMOUNT'
    or program_record.unit_name_singular <> 'punto'
    or program_record.unit_name_plural <> 'puntos'
    or not program_record.welcome_reward_enabled
    or program_record.welcome_reward_name <> 'Churro individual'
    or not program_record.grant_welcome_reward_to_imports
    or program_record.import_stamp_to_point_multiplier <> 10
    or program_record.allow_purchase_cancellations
    or program_record.allow_reward_cancellations
    or not program_record.allow_redemption_reversals
    or audit_count <> 1 then
    raise exception 'Lifetime program options were not persisted atomically';
  end if;
end;
$$;

reset role;

do $$
declare
  large_catalog jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'stamps_required', level,
    'name', 'Premio ' || level,
    'description', 'Descripción ' || level,
    'expiration_days', null
  ))
  into large_catalog
  from generate_series(1, 12) level;

  if not app.reward_tiers_are_valid(large_catalog) then
    raise exception 'Reward catalogs above ten levels remain artificially limited';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
declare
  tenant_program_id uuid;
  result_record record;
begin
  select id into tenant_program_id
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select * into result_record
  from app.save_loyalty_program_configuration(
    tenant_program_id,
    'Cambio bloqueado',
    'PAUSED',
    'LIFETIME_POINTS',
    'PER_AMOUNT',
    0,
    1,
    1000,
    false,
    'El tipo no debe cambiar cuando el programa ya tiene actividad.',
    '[{"stamps_required": 100, "name": "Premio", "description": "Premio", "expiration_days": null}]'::jsonb,
    'punto',
    'puntos',
    false,
    null,
    null,
    null,
    false,
    1,
    false,
    false,
    true
  );

  if result_record.result <> 'TYPE_LOCKED' then
    raise exception 'Program type changed after loyalty activity';
  end if;
end;
$$;

reset role;
rollback;

select 'Configurable loyalty program type assertions passed' as result;
