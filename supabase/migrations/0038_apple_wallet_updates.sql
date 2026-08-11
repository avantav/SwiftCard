-- Phase 8: Apple Wallet device registrations, update tags, and durable push outbox.

create type public.apple_wallet_device_status as enum ('ACTIVE', 'INVALID');

create sequence public.apple_wallet_update_tag_seq;

alter table public.wallet_passes
  add column update_tag bigint not null default nextval('public.apple_wallet_update_tag_seq'),
  add column update_pending_at timestamptz,
  add column last_push_at timestamptz;

alter sequence public.apple_wallet_update_tag_seq owned by public.wallet_passes.update_tag;

create table public.apple_wallet_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  device_library_identifier_hash text not null unique,
  push_token_hash text not null,
  push_token_ciphertext text not null,
  status public.apple_wallet_device_status not null default 'ACTIVE',
  last_registered_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apple_wallet_devices_library_hash_format
    check (device_library_identifier_hash ~ '^[0-9a-f]{64}$'),
  constraint apple_wallet_devices_push_hash_format
    check (push_token_hash ~ '^[0-9a-f]{64}$'),
  constraint apple_wallet_devices_ciphertext_length
    check (length(push_token_ciphertext) between 24 and 4096),
  constraint apple_wallet_devices_status_consistency check (
    (status = 'ACTIVE' and invalidated_at is null)
    or (status = 'INVALID' and invalidated_at is not null)
  )
);

create table public.apple_wallet_registrations (
  device_id uuid not null references public.apple_wallet_devices(id) on delete cascade,
  wallet_pass_id uuid not null references public.wallet_passes(id) on delete cascade,
  last_notified_update_tag bigint not null default 0,
  last_notified_at timestamptz,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, wallet_pass_id),
  constraint apple_wallet_registrations_tag_nonnegative
    check (last_notified_update_tag >= 0)
);

create table public.apple_wallet_update_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  wallet_pass_id uuid not null unique references public.wallet_passes(id) on delete cascade,
  update_tag bigint not null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_error text,
  claim_token uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apple_wallet_update_outbox_tag_positive check (update_tag > 0),
  constraint apple_wallet_update_outbox_attempts_nonnegative check (attempt_count >= 0),
  constraint apple_wallet_update_outbox_error_length
    check (last_error is null or length(last_error) <= 500),
  constraint apple_wallet_update_outbox_claim_consistency check (
    (claim_token is null and locked_until is null)
    or (claim_token is not null and locked_until is not null)
  )
);

create index apple_wallet_registrations_pass_idx
  on public.apple_wallet_registrations (wallet_pass_id, last_notified_update_tag);
create index apple_wallet_update_outbox_due_idx
  on public.apple_wallet_update_outbox (next_attempt_at, locked_until);

create trigger apple_wallet_devices_set_updated_at
  before update on public.apple_wallet_devices
  for each row execute function app.set_updated_at();
create trigger apple_wallet_registrations_set_updated_at
  before update on public.apple_wallet_registrations
  for each row execute function app.set_updated_at();
create trigger apple_wallet_update_outbox_set_updated_at
  before update on public.apple_wallet_update_outbox
  for each row execute function app.set_updated_at();

alter table public.apple_wallet_devices enable row level security;
alter table public.apple_wallet_registrations enable row level security;
alter table public.apple_wallet_update_outbox enable row level security;
alter table public.apple_wallet_devices force row level security;
alter table public.apple_wallet_registrations force row level security;
alter table public.apple_wallet_update_outbox force row level security;

revoke all on public.apple_wallet_devices from public, anon, authenticated, service_role;
revoke all on public.apple_wallet_registrations from public, anon, authenticated, service_role;
revoke all on public.apple_wallet_update_outbox from public, anon, authenticated, service_role;
revoke all on sequence public.apple_wallet_update_tag_seq from public, anon, authenticated, service_role;

create function app.queue_apple_wallet_customer_updates(
  target_tenant_id uuid,
  target_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  changed_pass record;
begin
  if target_tenant_id is null or target_customer_id is null then
    return;
  end if;

  for changed_pass in
    update public.wallet_passes wallet_pass
       set update_tag = nextval('public.apple_wallet_update_tag_seq'),
           status = 'UPDATE_PENDING',
           update_pending_at = now(),
           last_error = null
     where wallet_pass.provider = 'APPLE'
       and wallet_pass.tenant_id = target_tenant_id
       and wallet_pass.customer_id = target_customer_id
       and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING', 'FAILED')
       and exists (
         select 1
         from public.apple_wallet_registrations registration
         where registration.wallet_pass_id = wallet_pass.id
       )
    returning wallet_pass.id, wallet_pass.update_tag
  loop
    insert into public.apple_wallet_update_outbox (
      wallet_pass_id,
      update_tag
    )
    values (
      changed_pass.id,
      changed_pass.update_tag
    )
    on conflict (wallet_pass_id) do update
      set update_tag = excluded.update_tag,
          attempt_count = 0,
          next_attempt_at = now(),
          last_attempt_at = null,
          last_error = null,
          claim_token = null,
          locked_until = null,
          updated_at = now();
  end loop;
end;
$$;

create function app.queue_apple_wallet_tenant_updates(target_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  changed_pass record;
begin
  if target_tenant_id is null then
    return;
  end if;

  for changed_pass in
    update public.wallet_passes wallet_pass
       set update_tag = nextval('public.apple_wallet_update_tag_seq'),
           status = 'UPDATE_PENDING',
           update_pending_at = now(),
           last_error = null
     where wallet_pass.provider = 'APPLE'
       and wallet_pass.tenant_id = target_tenant_id
       and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING', 'FAILED')
       and exists (
         select 1
         from public.apple_wallet_registrations registration
         where registration.wallet_pass_id = wallet_pass.id
       )
    returning wallet_pass.id, wallet_pass.update_tag
  loop
    insert into public.apple_wallet_update_outbox (
      wallet_pass_id,
      update_tag
    )
    values (
      changed_pass.id,
      changed_pass.update_tag
    )
    on conflict (wallet_pass_id) do update
      set update_tag = excluded.update_tag,
          attempt_count = 0,
          next_attempt_at = now(),
          last_attempt_at = null,
          last_error = null,
          claim_token = null,
          locked_until = null,
          updated_at = now();
  end loop;
end;
$$;

create function app.queue_apple_wallet_customer_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  changed_data jsonb;
  changed_customer_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_data := to_jsonb(old);
  else
    changed_data := to_jsonb(new);
  end if;
  changed_customer_id := case
    when tg_table_name = 'customers' then (changed_data ->> 'id')::uuid
    else (changed_data ->> 'customer_id')::uuid
  end;
  perform app.queue_apple_wallet_customer_updates(
    (changed_data ->> 'tenant_id')::uuid,
    changed_customer_id
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function app.queue_apple_wallet_tenant_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  changed_data jsonb;
begin
  if tg_op = 'DELETE' then
    changed_data := to_jsonb(old);
  else
    changed_data := to_jsonb(new);
  end if;
  perform app.queue_apple_wallet_tenant_updates(
    case
      when tg_table_name = 'tenants' then (changed_data ->> 'id')::uuid
      else (changed_data ->> 'tenant_id')::uuid
    end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger apple_wallet_balance_changed
  after insert or delete or update of stamp_balance
  on public.customer_loyalty_balances
  for each row execute function app.queue_apple_wallet_customer_row_change();
create trigger apple_wallet_reward_changed
  after insert or delete or update of status, expires_at
  on public.rewards
  for each row execute function app.queue_apple_wallet_customer_row_change();
create trigger apple_wallet_customer_changed
  after update of full_name, status on public.customers
  for each row execute function app.queue_apple_wallet_customer_row_change();
create trigger apple_wallet_card_changed
  after update of public_token, status on public.customer_cards
  for each row execute function app.queue_apple_wallet_customer_row_change();

create trigger apple_wallet_design_changed
  after insert or update or delete on public.tenant_wallet_designs
  for each row execute function app.queue_apple_wallet_tenant_row_change();
create trigger apple_wallet_program_changed
  after insert or delete or update of name, status, reward_stamp_goal, terms_and_conditions
  on public.loyalty_programs
  for each row execute function app.queue_apple_wallet_tenant_row_change();
create trigger apple_wallet_reward_tier_changed
  after insert or delete or update of stamps_required, name, description, active
  on public.loyalty_reward_tiers
  for each row execute function app.queue_apple_wallet_tenant_row_change();
create trigger apple_wallet_branch_changed
  after insert or delete or update of name, status, latitude, longitude, proximity_enabled, proximity_message
  on public.branches
  for each row execute function app.queue_apple_wallet_tenant_row_change();
create trigger apple_wallet_tenant_changed
  after update of name, status, branding_mode, logo_url, banner_url on public.tenants
  for each row execute function app.queue_apple_wallet_tenant_row_change();

create function app.register_apple_wallet_device(
  target_serial_number text,
  target_device_library_hash text,
  target_push_token_hash text,
  target_push_token_ciphertext text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  pass_record record;
  saved_device_id uuid;
  registration_created boolean := false;
begin
  if target_device_library_hash !~ '^[0-9a-f]{64}$'
    or target_push_token_hash !~ '^[0-9a-f]{64}$'
    or length(target_push_token_ciphertext) not between 24 and 4096 then
    return 'INVALID';
  end if;

  select wallet_pass.id, wallet_pass.update_tag
    into pass_record
  from public.wallet_passes wallet_pass
  where wallet_pass.provider = 'APPLE'
    and wallet_pass.serial_number = target_serial_number
    and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING');

  if pass_record.id is null then
    return 'NOT_FOUND';
  end if;

  insert into public.apple_wallet_devices (
    device_library_identifier_hash,
    push_token_hash,
    push_token_ciphertext,
    status,
    last_registered_at,
    invalidated_at
  )
  values (
    target_device_library_hash,
    target_push_token_hash,
    target_push_token_ciphertext,
    'ACTIVE',
    now(),
    null
  )
  on conflict (device_library_identifier_hash) do update
    set push_token_hash = excluded.push_token_hash,
        push_token_ciphertext = excluded.push_token_ciphertext,
        status = 'ACTIVE',
        last_registered_at = now(),
        invalidated_at = null,
        updated_at = now()
  returning id into saved_device_id;

  insert into public.apple_wallet_registrations (
    device_id,
    wallet_pass_id,
    last_notified_update_tag,
    last_notified_at
  )
  values (
    saved_device_id,
    pass_record.id,
    pass_record.update_tag,
    now()
  )
  on conflict (device_id, wallet_pass_id) do update
    set last_notified_update_tag = greatest(
          public.apple_wallet_registrations.last_notified_update_tag,
          excluded.last_notified_update_tag
        ),
        last_notified_at = now(),
        updated_at = now()
  returning (xmax = 0) into registration_created;

  delete from public.apple_wallet_update_outbox outbox
  where outbox.wallet_pass_id = pass_record.id
    and not exists (
      select 1
      from public.apple_wallet_registrations registration
      join public.apple_wallet_devices device on device.id = registration.device_id
      where registration.wallet_pass_id = pass_record.id
        and device.status = 'ACTIVE'
        and registration.last_notified_update_tag < outbox.update_tag
    );

  return case when registration_created then 'CREATED' else 'UPDATED' end;
end;
$$;

create function app.unregister_apple_wallet_device(
  target_serial_number text,
  target_device_library_hash text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  saved_device_id uuid;
  saved_wallet_pass_id uuid;
  deleted_count integer;
begin
  select device.id into saved_device_id
  from public.apple_wallet_devices device
  where device.device_library_identifier_hash = target_device_library_hash;

  if saved_device_id is null then
    return 'NOT_FOUND';
  end if;

  select wallet_pass.id into saved_wallet_pass_id
  from public.wallet_passes wallet_pass
  where wallet_pass.provider = 'APPLE'
    and wallet_pass.serial_number = target_serial_number;

  if saved_wallet_pass_id is null then
    return 'NOT_FOUND';
  end if;

  delete from public.apple_wallet_registrations registration
  where registration.device_id = saved_device_id
    and registration.wallet_pass_id = saved_wallet_pass_id;
  get diagnostics deleted_count = row_count;

  if not exists (
    select 1 from public.apple_wallet_registrations registration
    where registration.wallet_pass_id = saved_wallet_pass_id
  ) then
    delete from public.apple_wallet_update_outbox
    where wallet_pass_id = saved_wallet_pass_id;
  end if;

  if not exists (
    select 1 from public.apple_wallet_registrations registration
    where registration.device_id = saved_device_id
  ) then
    delete from public.apple_wallet_devices where id = saved_device_id;
  end if;

  return case when deleted_count > 0 then 'DELETED' else 'NOT_FOUND' end;
end;
$$;

create function app.list_apple_wallet_updates(
  target_device_library_hash text,
  target_previous_update_tag bigint default null
)
returns table (serial_number text, update_tag text)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select wallet_pass.serial_number, wallet_pass.update_tag::text
  from public.apple_wallet_devices device
  join public.apple_wallet_registrations registration
    on registration.device_id = device.id
  join public.wallet_passes wallet_pass
    on wallet_pass.id = registration.wallet_pass_id
  where device.device_library_identifier_hash = target_device_library_hash
    and device.status = 'ACTIVE'
    and wallet_pass.provider = 'APPLE'
    and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING', 'FAILED')
    and (
      target_previous_update_tag is null
      or wallet_pass.update_tag > target_previous_update_tag
    )
  order by wallet_pass.update_tag, wallet_pass.serial_number;
$$;

create function app.claim_apple_wallet_updates(
  target_limit integer default 10,
  target_lease_seconds integer default 30,
  target_tenant_id uuid default null,
  target_customer_id uuid default null
)
returns table (
  outbox_id uuid,
  wallet_pass_id uuid,
  serial_number text,
  update_tag text,
  attempt_count integer,
  claim_token uuid
)
language sql
security definer
set search_path = public, app, auth, extensions
as $$
  with candidates as (
    select outbox.id
    from public.apple_wallet_update_outbox outbox
    join public.wallet_passes candidate_pass
      on candidate_pass.id = outbox.wallet_pass_id
    where outbox.next_attempt_at <= now()
      and (outbox.locked_until is null or outbox.locked_until <= now())
      and (target_tenant_id is null or candidate_pass.tenant_id = target_tenant_id)
      and (target_customer_id is null or candidate_pass.customer_id = target_customer_id)
    order by outbox.next_attempt_at, outbox.created_at
    for update skip locked
    limit least(greatest(target_limit, 1), 50)
  ), claimed as (
    update public.apple_wallet_update_outbox outbox
       set claim_token = extensions.gen_random_uuid(),
           locked_until = now() + make_interval(secs => least(greatest(target_lease_seconds, 10), 300)),
           attempt_count = outbox.attempt_count + 1,
           last_attempt_at = now(),
           updated_at = now()
      from candidates
     where outbox.id = candidates.id
    returning outbox.*
  )
  select claimed.id,
         claimed.wallet_pass_id,
         wallet_pass.serial_number,
         claimed.update_tag::text,
         claimed.attempt_count,
         claimed.claim_token
  from claimed
  join public.wallet_passes wallet_pass on wallet_pass.id = claimed.wallet_pass_id;
$$;

create function app.get_apple_wallet_push_targets(
  target_wallet_pass_id uuid,
  target_update_tag bigint
)
returns table (
  device_id uuid,
  push_token_ciphertext text
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select device.id, device.push_token_ciphertext
  from public.apple_wallet_registrations registration
  join public.apple_wallet_devices device on device.id = registration.device_id
  where registration.wallet_pass_id = target_wallet_pass_id
    and registration.last_notified_update_tag < target_update_tag
    and device.status = 'ACTIVE'
  order by device.id;
$$;

create function app.record_apple_wallet_push_success(
  target_wallet_pass_id uuid,
  target_device_id uuid,
  target_update_tag bigint
)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  update public.apple_wallet_registrations
     set last_notified_update_tag = greatest(last_notified_update_tag, target_update_tag),
         last_notified_at = now(),
         updated_at = now()
   where wallet_pass_id = target_wallet_pass_id
     and device_id = target_device_id;

  update public.wallet_passes
     set last_push_at = now()
   where id = target_wallet_pass_id;
end;
$$;

create function app.invalidate_apple_wallet_device(target_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  update public.apple_wallet_devices
     set status = 'INVALID',
         invalidated_at = now(),
         updated_at = now()
   where id = target_device_id;

  delete from public.apple_wallet_registrations
  where device_id = target_device_id;
end;
$$;

create function app.complete_apple_wallet_update(
  target_outbox_id uuid,
  target_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  removed_count integer;
begin
  delete from public.apple_wallet_update_outbox
  where id = target_outbox_id
    and claim_token = target_claim_token;
  get diagnostics removed_count = row_count;
  return removed_count = 1;
end;
$$;

create function app.retry_apple_wallet_update(
  target_outbox_id uuid,
  target_claim_token uuid,
  target_error text,
  target_delay_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  updated_count integer;
begin
  update public.apple_wallet_update_outbox
     set next_attempt_at = now() + make_interval(
           secs => least(greatest(target_delay_seconds, 15), 86400)
         ),
         last_error = left(coalesce(target_error, 'APNs delivery failed.'), 500),
         claim_token = null,
         locked_until = null,
         updated_at = now()
   where id = target_outbox_id
     and claim_token = target_claim_token;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function app.queue_apple_wallet_customer_updates(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.queue_apple_wallet_tenant_updates(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.queue_apple_wallet_customer_row_change()
  from public, anon, authenticated, service_role;
revoke all on function app.queue_apple_wallet_tenant_row_change()
  from public, anon, authenticated, service_role;

revoke all on function app.register_apple_wallet_device(text, text, text, text)
  from public, anon, authenticated;
revoke all on function app.unregister_apple_wallet_device(text, text)
  from public, anon, authenticated;
revoke all on function app.list_apple_wallet_updates(text, bigint)
  from public, anon, authenticated;
revoke all on function app.claim_apple_wallet_updates(integer, integer, uuid, uuid)
  from public, anon, authenticated;
revoke all on function app.get_apple_wallet_push_targets(uuid, bigint)
  from public, anon, authenticated;
revoke all on function app.record_apple_wallet_push_success(uuid, uuid, bigint)
  from public, anon, authenticated;
revoke all on function app.invalidate_apple_wallet_device(uuid)
  from public, anon, authenticated;
revoke all on function app.complete_apple_wallet_update(uuid, uuid)
  from public, anon, authenticated;
revoke all on function app.retry_apple_wallet_update(uuid, uuid, text, integer)
  from public, anon, authenticated;

grant execute on function app.register_apple_wallet_device(text, text, text, text)
  to service_role;
grant execute on function app.unregister_apple_wallet_device(text, text)
  to service_role;
grant execute on function app.list_apple_wallet_updates(text, bigint)
  to service_role;
grant execute on function app.claim_apple_wallet_updates(integer, integer, uuid, uuid)
  to service_role;
grant execute on function app.get_apple_wallet_push_targets(uuid, bigint)
  to service_role;
grant execute on function app.record_apple_wallet_push_success(uuid, uuid, bigint)
  to service_role;
grant execute on function app.invalidate_apple_wallet_device(uuid)
  to service_role;
grant execute on function app.complete_apple_wallet_update(uuid, uuid)
  to service_role;
grant execute on function app.retry_apple_wallet_update(uuid, uuid, text, integer)
  to service_role;

notify pgrst, 'reload schema';
