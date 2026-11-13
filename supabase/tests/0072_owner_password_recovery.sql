\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000007201', 'owner-recovery@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000007202', 'manager-recovery@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000007203', 'owner-suspended-recovery@swiftwallet.test');

insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('00000000-0000-0000-0000-000000007201', '10000000-0000-0000-0000-000000000001', 'Owner-Recovery@swiftwallet.test', 'Owner', 'ADMIN', 'PASSWORD_RESET_REQUIRED'),
  ('00000000-0000-0000-0000-000000007202', '10000000-0000-0000-0000-000000000001', 'manager-recovery@swiftwallet.test', 'Manager', 'MANAGER', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000007203', '10000000-0000-0000-0000-000000000003', 'owner-suspended-recovery@swiftwallet.test', 'Suspended owner', 'ADMIN', 'ACTIVE');

set role authenticated;

do $$
begin
  begin
    perform app.request_owner_password_recovery('owner-recovery@swiftwallet.test', repeat('a', 64), repeat('b', 64));
    raise exception 'Authenticated role requested an owner recovery directly';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from public.password_recovery_requests;
    raise exception 'Authenticated role read recovery request storage';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set role service_role;

do $$
declare
  result uuid;
  completed boolean;
begin
  -- Owner (case-insensitive email) is eligible even with a pending temporary password.
  result := app.request_owner_password_recovery(' owner-recovery@SWIFTWALLET.test ', repeat('1', 64), repeat('c', 64));
  if result is distinct from '00000000-0000-0000-0000-000000007201'::uuid then
    raise exception 'Eligible owner was not resolved: %', result;
  end if;

  -- Branch administrators, suspended tenants and unknown emails are not.
  if app.request_owner_password_recovery('manager-recovery@swiftwallet.test', repeat('2', 64), repeat('c', 64)) is not null then
    raise exception 'Branch administrator was eligible for email recovery';
  end if;
  if app.request_owner_password_recovery('owner-suspended-recovery@swiftwallet.test', repeat('3', 64), repeat('c', 64)) is not null then
    raise exception 'Owner of a suspended tenant was eligible for email recovery';
  end if;
  if app.request_owner_password_recovery('nobody@swiftwallet.test', repeat('4', 64), repeat('c', 64)) is not null then
    raise exception 'Unknown email resolved to an account';
  end if;

  -- Per-email limit: two more requests are accepted, the fourth in the hour is not.
  perform app.request_owner_password_recovery('owner-recovery@swiftwallet.test', repeat('1', 64), repeat('d', 64));
  perform app.request_owner_password_recovery('owner-recovery@swiftwallet.test', repeat('1', 64), repeat('d', 64));
  if app.request_owner_password_recovery('owner-recovery@swiftwallet.test', repeat('1', 64), repeat('d', 64)) is not null then
    raise exception 'Per-email rate limit was not enforced';
  end if;

  -- Per-client limit: ten requests from one client per hour.
  for i in 1..10 loop
    perform app.request_owner_password_recovery('nobody@swiftwallet.test', lpad(to_hex(100 + i), 64, '0'), repeat('e', 64));
  end loop;
  if app.request_owner_password_recovery('owner-recovery@swiftwallet.test', repeat('5', 64), repeat('e', 64)) is not null then
    raise exception 'Per-client rate limit was not enforced';
  end if;

  -- Invalid hashes are refused without touching storage.
  if app.request_owner_password_recovery('owner-recovery@swiftwallet.test', 'plain@email', repeat('f', 64)) is not null then
    raise exception 'Unhashed email was accepted';
  end if;

  -- Completion activates the owner, clears the temporary password and audits.
  completed := app.complete_owner_password_recovery('00000000-0000-0000-0000-000000007201');
  if not completed or (
    select status <> 'ACTIVE' or temporary_password_expires_at is not null or last_password_change_at is null
    from public.staff_profiles where id = '00000000-0000-0000-0000-000000007201'
  ) then
    raise exception 'Owner recovery did not activate the profile';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'OWNER_PASSWORD_RECOVERED'
      and entity_id = '00000000-0000-0000-0000-000000007201'
      and metadata ->> 'previous_status' = 'PASSWORD_RESET_REQUIRED'
  ) then
    raise exception 'Owner recovery was not audited';
  end if;

  if app.complete_owner_password_recovery('00000000-0000-0000-0000-000000007202') then
    raise exception 'Branch administrator recovery was completed';
  end if;
end;
$$;

reset role;
