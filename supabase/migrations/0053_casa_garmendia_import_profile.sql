-- One-time Casa Garmendia legacy-stamp import. Tenant Admins can preview a
-- fixed spreadsheet profile, but PostgreSQL remains authoritative for tenant,
-- card, branch, conversion, milestone generation and single-use enforcement.

alter table public.customer_imports
  add column import_profile_code text,
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict,
  add column source_branch_id uuid references public.branches(id) on delete restrict,
  add column prepared_rows jsonb not null default '[]'::jsonb;

alter table public.customer_imports
  add constraint customer_imports_profile_code_length check (
    import_profile_code is null or length(import_profile_code) between 1 and 80
  ),
  add constraint customer_imports_prepared_rows_array check (
    jsonb_typeof(prepared_rows) = 'array'
  ),
  add constraint customer_imports_profile_scope_complete check (
    (import_profile_code is null and loyalty_card_id is null and source_branch_id is null)
    or (import_profile_code is not null and loyalty_card_id is not null and source_branch_id is not null)
  );

create unique index customer_imports_profile_confirmed_once_idx
  on public.customer_imports (tenant_id, import_profile_code)
  where status = 'CONFIRMED' and import_profile_code is not null;

alter table public.customers
  add column customer_import_id uuid references public.customer_imports(id) on delete restrict;

create index customers_customer_import_idx
  on public.customers (customer_import_id)
  where customer_import_id is not null;

create function app.tenant_has_casa_garmendia_import_profile(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(
    target_tenant_id = app.current_staff_tenant_id()
    and app.current_staff_role() = 'ADMIN'
    and (
      select lower(tenant.name) like '%garmendia%'
        or lower(tenant.name) like '%germendia%'
      from public.tenants tenant
      where tenant.id = target_tenant_id
    ),
    false
  );
$$;

revoke all on function app.tenant_has_casa_garmendia_import_profile(uuid)
  from public, anon, authenticated;
grant execute on function app.tenant_has_casa_garmendia_import_profile(uuid)
  to authenticated;

create policy customer_imports_tenant_admin_select
  on public.customer_imports for select to authenticated
  using (
    app.current_staff_role() = 'ADMIN'
    and app.current_staff_tenant_id() = tenant_id
  );

create policy customer_imports_tenant_admin_insert
  on public.customer_imports for insert to authenticated
  with check (
    app.current_staff_role() = 'ADMIN'
    and app.current_staff_tenant_id() = tenant_id
    and uploaded_by = auth.uid()
    and status = 'PREVIEWED'
    and import_profile_code = 'CASA_GARMENDIA_LEGACY_STAMPS_2026'
    and app.tenant_has_casa_garmendia_import_profile(tenant_id)
    and exists (
      select 1
      from public.loyalty_cards card
      join public.loyalty_programs program on program.id = card.program_id
      where card.id = loyalty_card_id
        and card.tenant_id = customer_imports.tenant_id
        and card.status = 'PUBLISHED'
        and program.program_type = 'LIFETIME_POINTS'
    )
    and exists (
      select 1
      from public.branches branch
      join public.loyalty_card_branches assignment
        on assignment.branch_id = branch.id
       and assignment.loyalty_card_id = customer_imports.loyalty_card_id
      where branch.id = source_branch_id
        and branch.tenant_id = customer_imports.tenant_id
        and branch.status = 'ACTIVE'
    )
  );

create function app.confirm_casa_garmendia_customer_import(target_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  import_record public.customer_imports%rowtype;
  card_record record;
  row_value jsonb;
  customer_id_value uuid;
  legacy_stamps integer;
  imported_points integer;
  imported_count integer := 0;
  duplicate_count integer := 0;
  rewards_count integer := 0;
  milestone_result record;
begin
  select staff.id, staff.tenant_id into staff_record
  from public.staff_profiles staff
  join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid()
    and staff.role = 'ADMIN'
    and staff.status = 'ACTIVE'
    and tenant.status = 'ACTIVE';

  if staff_record.id is null then
    return jsonb_build_object('result', 'UNAVAILABLE');
  end if;

  select import_row.* into import_record
  from public.customer_imports import_row
  where import_row.id = target_import_id
    and import_row.tenant_id = staff_record.tenant_id
  for update;

  if import_record.id is null
    or import_record.import_profile_code is distinct from 'CASA_GARMENDIA_LEGACY_STAMPS_2026'
    or import_record.uploaded_by is distinct from staff_record.id
    or not app.tenant_has_casa_garmendia_import_profile(staff_record.tenant_id) then
    return jsonb_build_object('result', 'UNAVAILABLE');
  end if;

  if import_record.status = 'CONFIRMED' then
    return jsonb_build_object('result', 'ALREADY_CONFIRMED');
  end if;
  if import_record.status <> 'PREVIEWED'
    or import_record.total_rows not between 1 and 5000
    or jsonb_typeof(import_record.prepared_rows) <> 'array'
    or jsonb_array_length(import_record.prepared_rows) + import_record.error_rows
      <> import_record.total_rows then
    return jsonb_build_object('result', 'INVALID_PREVIEW');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'swiftwallet:import-profile:' || staff_record.tenant_id::text
      || ':CASA_GARMENDIA_LEGACY_STAMPS_2026', 0
  ));

  if exists (
    select 1 from public.customer_imports previous_import
    where previous_import.tenant_id = staff_record.tenant_id
      and previous_import.import_profile_code = import_record.import_profile_code
      and previous_import.status = 'CONFIRMED'
      and previous_import.id <> import_record.id
  ) then
    return jsonb_build_object('result', 'PROFILE_ALREADY_USED');
  end if;

  select card.id, card.program_id, program.version into card_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  where card.id = import_record.loyalty_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status = 'PUBLISHED'
    and program.status = 'ACTIVE'
    and program.program_type = 'LIFETIME_POINTS'
  for update of card, program;

  if card_record.id is null
    or not exists (
      select 1
      from public.branches branch
      join public.loyalty_card_branches assignment
        on assignment.branch_id = branch.id
       and assignment.loyalty_card_id = card_record.id
      where branch.id = import_record.source_branch_id
        and branch.tenant_id = staff_record.tenant_id
        and branch.status = 'ACTIVE'
    )
    or exists (
      select 1
      from unnest(array[100, 200, 300, 400, 500, 650, 860]) required(points)
      where not exists (
        select 1 from public.loyalty_reward_tiers tier
        where tier.program_id = card_record.program_id
          and tier.stamps_required = required.points
          and tier.active
      )
    ) then
    return jsonb_build_object('result', 'PROFILE_MISMATCH');
  end if;

  for row_value in select value from jsonb_array_elements(import_record.prepared_rows)
  loop
    if coalesce(length(btrim(row_value->>'full_name')), 0) not between 1 and 200
      or (row_value->>'normalized_phone') !~ '^\+[1-9][0-9]{7,14}$'
      or (row_value->>'legacy_stamps') !~ '^[0-9]+$'
      or coalesce((row_value->>'legacy_stamps')::integer, -1) not between 0 and 15
      or (
        nullif(row_value->>'email', '') is not null
        and (
          length(row_value->>'email') > 320
          or (row_value->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
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
      raise check_violation using message = 'Invalid prepared Casa Garmendia row';
    end if;

    legacy_stamps := (row_value->>'legacy_stamps')::integer;
    imported_points := case
      when legacy_stamps >= 15 then 860
      when legacy_stamps >= 13 then 650
      when legacy_stamps >= 10 then 500
      when legacy_stamps >= 7 then 400
      when legacy_stamps >= 6 then 300
      when legacy_stamps >= 4 then 200
      when legacy_stamps >= 3 then 100
      else 0
    end;

    if exists (
      select 1 from public.customers customer
      where customer.tenant_id = staff_record.tenant_id
        and customer.normalized_phone = row_value->>'normalized_phone'
    ) then
      duplicate_count := duplicate_count + 1;
      continue;
    end if;

    begin
      insert into public.customers (
        tenant_id, full_name, normalized_phone, email, birth_date,
        privacy_consent, registration_method, source_branch_id,
        created_by_staff_id, customer_import_id
      ) values (
        staff_record.tenant_id,
        btrim(row_value->>'full_name'),
        row_value->>'normalized_phone',
        nullif(lower(btrim(row_value->>'email')), ''),
        nullif(row_value->>'birth_date', '')::date,
        false,
        'SELF_SERVICE',
        import_record.source_branch_id,
        staff_record.id,
        import_record.id
      ) returning id into customer_id_value;

      insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
      values (staff_record.tenant_id, customer_id_value, card_record.id);

      insert into public.customer_loyalty_balances (
        tenant_id, customer_id, stamp_balance, remainder_minor,
        lifetime_points_tenths
      ) values (
        staff_record.tenant_id, customer_id_value, 0, 0, 0
      );

      insert into public.rewards (
        tenant_id, customer_id, program_id, name, description,
        stamps_required_snapshot, program_version_snapshot, loyalty_card_id
      ) values (
        staff_record.tenant_id, customer_id_value, card_record.program_id,
        'Churro individual',
        'Premio de registro asignado durante la importación inicial.',
        0, card_record.version, card_record.id
      );
      rewards_count := rewards_count + 1;

      select * into milestone_result
      from app.apply_lifetime_point_milestones(
        customer_id_value,
        card_record.program_id,
        card_record.id,
        0,
        imported_points::bigint * 10,
        null
      );
      rewards_count := rewards_count + milestone_result.rewards_generated;

      insert into public.stamp_ledger (
        tenant_id, customer_id, entry_type, stamps_delta, balance_after,
        remainder_after_minor, reason, created_by_staff_id,
        loyalty_card_id, units_delta_tenths, balance_after_tenths
      ) values (
        staff_record.tenant_id, customer_id_value, 'ADJUSTMENT',
        imported_points, imported_points, 0,
        'Importación Casa Garmendia: ' || legacy_stamps::text
          || ' sellos anteriores = ' || imported_points::text || ' puntos',
        staff_record.id, card_record.id,
        imported_points::bigint * 10, imported_points::bigint * 10
      );

      imported_count := imported_count + 1;
    exception when unique_violation then
      duplicate_count := duplicate_count + 1;
    end;
  end loop;

  update public.customer_imports
  set status = 'CONFIRMED',
      imported_rows = imported_count,
      duplicate_rows = duplicate_count,
      updated_at = now()
  where id = import_record.id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id,
    'CASA_GARMENDIA_CUSTOMERS_IMPORTED', 'customer_imports', import_record.id,
    jsonb_build_object(
      'profile_code', import_record.import_profile_code,
      'loyalty_card_id', card_record.id,
      'source_branch_id', import_record.source_branch_id,
      'imported', imported_count,
      'duplicates', duplicate_count,
      'errors', import_record.error_rows,
      'rewards_generated', rewards_count,
      'conversion', 'LEGACY_STAMPS_TO_LIFETIME_POINTS'
    )
  );

  return jsonb_build_object(
    'result', 'CONFIRMED',
    'imported', imported_count,
    'duplicates', duplicate_count,
    'errors', import_record.error_rows,
    'rewards', rewards_count
  );
exception
  when check_violation or foreign_key_violation or invalid_text_representation
    or numeric_value_out_of_range then
    return jsonb_build_object('result', 'INVALID_PREVIEW');
end;
$$;

revoke all on function app.confirm_casa_garmendia_customer_import(uuid)
  from public, anon, authenticated;
grant execute on function app.confirm_casa_garmendia_customer_import(uuid)
  to authenticated;

-- Imported customers may recover the same issued card from the public branch
-- form. The submitted name must match the imported profile, the selected card
-- and branch must still participate, and the claim screen remains responsible
-- for current terms acceptance before Wallet delivery.
create or replace function app.register_public_customer(
  target_branch_token text,
  target_loyalty_card_id uuid,
  target_full_name text,
  target_normalized_phone text,
  target_email text,
  target_birth_date date,
  target_privacy_consent boolean
)
returns table (result text, card_token text)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  branch_record record;
  card_record record;
  existing_record record;
  customer_id_value uuid;
  card_token_value text;
begin
  if not target_privacy_consent
    or nullif(btrim(target_branch_token), '') is null
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return query select 'INVALID', null::text;
    return;
  end if;

  select branch.id, branch.tenant_id into branch_record
  from public.branches branch
  join public.tenants tenant on tenant.id = branch.tenant_id
  where branch.public_registration_token = target_branch_token
    and branch.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select card.id, card.tenant_id, card.program_id into card_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id
   and assignment.branch_id = branch_record.id
  where card.id = target_loyalty_card_id
    and card.tenant_id = branch_record.tenant_id
    and card.status = 'PUBLISHED' and program.status = 'ACTIVE';

  if branch_record.id is null or card_record.id is null then
    return query select 'UNAVAILABLE', null::text;
    return;
  end if;

  select customer.id, customer.full_name, customer.status,
         issued.id as customer_card_id, issued.public_token, issued.status as card_status,
         issued.loyalty_card_id, import_record.import_profile_code,
         import_record.status as import_status
  into existing_record
  from public.customers customer
  left join public.customer_cards issued on issued.customer_id = customer.id
  left join public.customer_imports import_record
    on import_record.id = customer.customer_import_id
  where customer.tenant_id = branch_record.tenant_id
    and customer.normalized_phone = target_normalized_phone;

  if existing_record.id is not null then
    if existing_record.status = 'ACTIVE'
      and existing_record.card_status = 'ACTIVE'
      and existing_record.loyalty_card_id = card_record.id
      and existing_record.import_profile_code = 'CASA_GARMENDIA_LEGACY_STAMPS_2026'
      and existing_record.import_status = 'CONFIRMED'
      and translate(
        lower(regexp_replace(btrim(existing_record.full_name), '[[:space:]]+', ' ', 'g')),
        'áéíóúüñ', 'aeiouun'
      ) = translate(
        lower(regexp_replace(btrim(target_full_name), '[[:space:]]+', ' ', 'g')),
        'áéíóúüñ', 'aeiouun'
      ) then
      update public.customers
      set privacy_consent = true
      where id = existing_record.id and not privacy_consent;

      insert into public.audit_logs (
        tenant_id, action, entity_type, entity_id, metadata
      ) values (
        branch_record.tenant_id, 'IMPORTED_CUSTOMER_CARD_RECOVERED',
        'customer_cards', existing_record.customer_card_id,
        jsonb_build_object('branch_id', branch_record.id, 'method', 'PUBLIC_REGISTRATION')
      );

      return query select 'IMPORTED_RECOVERY', existing_record.public_token;
      return;
    end if;
    return query select 'DUPLICATE', null::text;
    return;
  end if;

  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, email, birth_date,
      privacy_consent, registration_method, source_branch_id
    ) values (
      branch_record.tenant_id, btrim(target_full_name), target_normalized_phone,
      nullif(lower(btrim(target_email)), ''), target_birth_date,
      true, 'SELF_SERVICE', branch_record.id
    ) returning id into customer_id_value;
    insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
    values (branch_record.tenant_id, customer_id_value, card_record.id)
    returning public_token into card_token_value;
  exception when unique_violation then
    return query select 'DUPLICATE', null::text;
    return;
  end;
  return query select 'CREATED', card_token_value;
end;
$$;

revoke all on function app.register_public_customer(
  text, uuid, text, text, text, date, boolean
) from public, authenticated;
grant execute on function app.register_public_customer(
  text, uuid, text, text, text, date, boolean
) to anon;

drop function app.get_staff_customer_wallet_delivery(uuid);

create function app.get_staff_customer_wallet_delivery(
  target_customer_card_id uuid
)
returns table (
  card_token text,
  apple_wallet_added boolean,
  repeat_delivery_allowed boolean
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    issued.public_token,
    exists (
      select 1
      from public.wallet_passes wallet_pass
      join public.apple_wallet_registrations registration
        on registration.wallet_pass_id = wallet_pass.id
      join public.apple_wallet_devices device
        on device.id = registration.device_id
       and device.status = 'ACTIVE'
      where wallet_pass.customer_card_id = issued.id
        and wallet_pass.provider = 'APPLE'
        and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING')
    ),
    exists (
      select 1
      from public.customers customer
      join public.customer_imports import_record
        on import_record.id = customer.customer_import_id
      where customer.id = issued.customer_id
        and import_record.status = 'CONFIRMED'
        and import_record.import_profile_code = 'CASA_GARMENDIA_LEGACY_STAMPS_2026'
    )
  from public.customer_cards issued
  where issued.id = target_customer_card_id
    and issued.status = 'ACTIVE'
    and exists (
      select 1
      from app.get_staff_customer_card_summary(target_customer_card_id) summary
      where summary.customer_card_id = issued.id
    );
$$;

revoke all on function app.get_staff_customer_wallet_delivery(uuid)
  from public, anon, authenticated;
grant execute on function app.get_staff_customer_wallet_delivery(uuid)
  to authenticated;
