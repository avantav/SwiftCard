-- Generic Superadmin customer import, card-scoped (DEC-0065).
-- The original confirm_customer_import (0026) predates multiple loyalty cards:
-- it issued customer cards without a loyalty card and stored initial stamps
-- as a raw stamp balance regardless of program type. The new version imports
-- into one published loyalty card that participates in the selected branch:
--   * stamp programs: initial stamps go through app.apply_reward_tiers, which
--     generates every completed cycle/tier reward and keeps the remainder;
--   * lifetime-points programs: initial stamps x import_stamp_to_point_multiplier
--     become points and every reached milestone is awarded in the same
--     transaction through app.apply_lifetime_point_milestones.
-- Welcome rewards follow the card's imported-customer option through the
-- existing customer_cards trigger. Everything is atomic and audited.

drop function if exists public.confirm_customer_import(uuid, uuid, jsonb);

create function public.confirm_customer_import(
  target_import_id uuid,
  target_branch_id uuid,
  target_loyalty_card_id uuid,
  valid_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  import_record public.customer_imports%rowtype;
  card_record record;
  row_value jsonb;
  customer_id_value uuid;
  initial_stamps integer;
  imported_tenths bigint;
  final_stamps integer;
  final_tenths bigint;
  tier_result record;
  imported_count integer := 0;
  duplicate_count integer := 0;
  row_count integer := 0;
  rewards_count integer := 0;
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;

  select * into import_record
  from public.customer_imports
  where id = target_import_id
  for update;
  if not found or import_record.status <> 'PREVIEWED' then
    raise exception 'import must be previewed' using errcode = '23514';
  end if;
  if jsonb_typeof(valid_rows) <> 'array' then
    raise exception 'valid rows must be an array' using errcode = '22023';
  end if;

  select card.id, card.program_id, program.version, program.program_type,
         program.import_stamp_to_point_multiplier
    into card_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  where card.id = target_loyalty_card_id
    and card.tenant_id = import_record.tenant_id
    and card.status = 'PUBLISHED'
  for update of card, program;

  if card_record.id is null or not exists (
    select 1
    from public.branches branch
    join public.loyalty_card_branches assignment
      on assignment.branch_id = branch.id
     and assignment.loyalty_card_id = card_record.id
    where branch.id = target_branch_id
      and branch.tenant_id = import_record.tenant_id
      and branch.status = 'ACTIVE'
  ) then
    raise exception 'loyalty card and branch must be published and assigned in the import tenant'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock_shared(
    hashtextextended('swiftwallet:tenant-program:' || import_record.tenant_id::text, 0)
  );

  for row_value in select value from jsonb_array_elements(valid_rows) loop
    row_count := row_count + 1;

    if coalesce(length(btrim(row_value->>'full_name')), 0) not between 1 and 200
      or coalesce(row_value->>'normalized_phone', '') !~ '^\+[1-9][0-9]{7,14}$'
      or coalesce(nullif(row_value->>'initial_stamps', ''), '0') !~ '^[0-9]{1,6}$'
      or (
        nullif(btrim(row_value->>'email'), '') is not null
        and (
          length(row_value->>'email') > 320
          or btrim(row_value->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
      )
      or (
        nullif(row_value->>'birth_date', '') is not null
        and case
          when (row_value->>'birth_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then (row_value->>'birth_date')::date not between date '1900-01-01' and current_date
          else true
        end
      ) then
      raise exception 'invalid import row %', row_count using errcode = '22023';
    end if;

    if exists (
      select 1 from public.customers c
      where c.tenant_id = import_record.tenant_id
        and c.normalized_phone = row_value->>'normalized_phone'
    ) then
      duplicate_count := duplicate_count + 1;
      continue;
    end if;

    initial_stamps := coalesce(nullif(row_value->>'initial_stamps', ''), '0')::integer;

    insert into public.customers (
      tenant_id, full_name, normalized_phone, email, birth_date,
      privacy_consent, registration_method, source_branch_id, customer_import_id
    ) values (
      import_record.tenant_id,
      btrim(row_value->>'full_name'),
      row_value->>'normalized_phone',
      nullif(lower(btrim(row_value->>'email')), ''),
      nullif(row_value->>'birth_date', '')::date,
      false,
      'SELF_SERVICE',
      target_branch_id,
      import_record.id
    ) returning id into customer_id_value;

    insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
    values (import_record.tenant_id, customer_id_value, card_record.id);

    insert into public.customer_loyalty_balances (
      tenant_id, customer_id, stamp_balance, remainder_minor, lifetime_points_tenths
    ) values (
      import_record.tenant_id, customer_id_value, 0, 0, 0
    );

    if initial_stamps > 0 then
      if card_record.program_type = 'LIFETIME_POINTS' then
        imported_tenths := initial_stamps::bigint * card_record.import_stamp_to_point_multiplier * 10;
        select * into tier_result
        from app.apply_lifetime_point_milestones(
          customer_id_value, card_record.program_id, card_record.id, 0, imported_tenths, null
        );
        final_tenths := tier_result.final_balance_tenths;
        final_stamps := floor(final_tenths::numeric / 10)::integer;
        rewards_count := rewards_count + tier_result.rewards_generated;

        insert into public.stamp_ledger (
          tenant_id, customer_id, entry_type, stamps_delta, balance_after,
          remainder_after_minor, reason, loyalty_card_id,
          units_delta_tenths, balance_after_tenths
        ) values (
          import_record.tenant_id, customer_id_value, 'ADJUSTMENT',
          (imported_tenths / 10)::integer, final_stamps, 0,
          'Importación inicial: ' || initial_stamps::text || ' sellos x '
            || card_record.import_stamp_to_point_multiplier::text || ' = '
            || (imported_tenths / 10)::text || ' puntos',
          card_record.id, imported_tenths, final_tenths
        );
      else
        select * into tier_result
        from app.apply_reward_tiers(
          customer_id_value, card_record.program_id, 0, initial_stamps, null, null
        );
        final_stamps := tier_result.final_balance;
        rewards_count := rewards_count + tier_result.rewards_generated;

        insert into public.stamp_ledger (
          tenant_id, customer_id, entry_type, stamps_delta, balance_after,
          remainder_after_minor, reason, loyalty_card_id,
          units_delta_tenths, balance_after_tenths
        ) values (
          import_record.tenant_id, customer_id_value, 'ADJUSTMENT',
          initial_stamps, final_stamps, 0,
          'Importación inicial: ' || initial_stamps::text || ' sellos',
          card_record.id, initial_stamps::bigint * 10, final_stamps::bigint * 10
        );
      end if;
    end if;

    imported_count := imported_count + 1;
  end loop;

  update public.customer_imports
  -- loyalty_card_id/source_branch_id stay null: on customer_imports they are
  -- reserved for profile imports (customer_imports_profile_scope_complete).
  -- The card and branch are recorded in the audit log instead.
  set status = 'CONFIRMED',
      imported_rows = imported_count,
      duplicate_rows = duplicate_count,
      error_rows = total_rows - row_count,
      updated_at = now()
  where id = target_import_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    import_record.tenant_id, auth.uid(), 'CUSTOMERS_IMPORTED', 'customer_imports', import_record.id,
    jsonb_build_object(
      'loyalty_card_id', card_record.id,
      'source_branch_id', target_branch_id,
      'program_type', card_record.program_type::text,
      'import_stamp_to_point_multiplier', card_record.import_stamp_to_point_multiplier,
      'imported', imported_count,
      'duplicates', duplicate_count,
      'rewards_generated', rewards_count
    )
  );

  return jsonb_build_object(
    'imported', imported_count,
    'duplicates', duplicate_count,
    'errors', import_record.total_rows - row_count,
    'rewards', rewards_count
  );
end;
$$;

revoke all on function public.confirm_customer_import(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.confirm_customer_import(uuid, uuid, uuid, jsonb)
to authenticated;
