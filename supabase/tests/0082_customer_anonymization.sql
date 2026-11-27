\set ON_ERROR_STOP on

-- Reuses tenant, branch and card from the 0073 test and adds its own Admin
-- general, a branch manager and a customer with history (a Wallet pass counts
-- as history for app.delete_admin_customer).

insert into auth.users (id, email) values
  ('82000000-0000-0000-0000-000000000011', 'admin-82@swiftwallet.test'),
  ('82000000-0000-0000-0000-000000000012', 'manager-82@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('82000000-0000-0000-0000-000000000011', '73000000-0000-0000-0000-0000000000a1', 'admin-82@swiftwallet.test', 'Admin 82', 'ADMIN', 'ACTIVE'),
  ('82000000-0000-0000-0000-000000000012', '73000000-0000-0000-0000-0000000000a1', 'manager-82@swiftwallet.test', 'Manager 82', 'MANAGER', 'ACTIVE');

insert into public.customers (
  id, tenant_id, full_name, normalized_phone, email, privacy_consent,
  registration_method, source_branch_id,
  marketing_consent, marketing_consent_at, marketing_consent_source
) values (
  '30000000-0000-0000-0000-000000000082', '73000000-0000-0000-0000-0000000000a1',
  'Cliente Para Anonimizar', '+528100000082', 'anon82@example.com', true,
  'SELF_SERVICE', '73000000-0000-0000-0000-0000000000b1',
  true, now(), 'SELF_SERVICE'
);
insert into public.customer_cards (id, tenant_id, customer_id, loyalty_card_id) values (
  '31000000-0000-0000-0000-000000000082', '73000000-0000-0000-0000-0000000000a1',
  '30000000-0000-0000-0000-000000000082', '73100000-0000-0000-0000-000000000001'
);
insert into public.wallet_passes (tenant_id, customer_id, customer_card_id, provider, status, serial_number)
values ('73000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000082',
  '31000000-0000-0000-0000-000000000082', 'APPLE', 'ACTIVE', 'serial-anon-82');

set role authenticated;

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000012', false);
do $$
declare
  target uuid := '30000000-0000-0000-0000-000000000082'::uuid;
begin
  if app.anonymize_admin_customer(target) <> 'UNAVAILABLE' then
    raise exception 'Branch-scoped staff anonymized a customer';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000011', false);
do $$
declare
  target uuid := '30000000-0000-0000-0000-000000000082'::uuid;
begin
  if app.delete_admin_customer(target) <> 'HAS_HISTORY' then
    raise exception 'Fixture customer has no history';
  end if;

  if app.anonymize_admin_customer(target) <> 'ANONYMIZED' then
    raise exception 'Admin general could not anonymize a customer with history';
  end if;
  if app.anonymize_admin_customer(target) <> 'ALREADY_ANONYMIZED' then
    raise exception 'Customer anonymized twice';
  end if;
  begin
    perform app.set_admin_customer_status(target, 'ACTIVE');
    raise exception 'Anonymized customer was reactivated';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  if app.anonymize_admin_customer('00000000-0000-0000-0000-0000000000ff') <> 'UNAVAILABLE' then
    raise exception 'Unknown customer did not return UNAVAILABLE';
  end if;

  perform set_config('test.anonymized_customer', target::text, false);
end;
$$;

reset role;

do $$
declare
  target uuid := current_setting('test.anonymized_customer')::uuid;
  customer record;
begin
  select * into customer from public.customers where id = target;
  if customer.full_name <> 'Cliente anonimizado'
    or customer.normalized_phone !~ '^\+999[0-9]{12}$'
    or customer.email is not null
    or customer.birth_date is not null
    or customer.marketing_consent
    or customer.status <> 'INACTIVE'
    or customer.anonymized_at is null then
    raise exception 'Customer was not anonymized: %', row_to_json(customer);
  end if;
  if exists (select 1 from public.customer_cards where customer_id = target and status <> 'REVOKED') then
    raise exception 'Customer card still active after anonymization';
  end if;
  if exists (select 1 from public.wallet_passes where customer_id = target and status <> 'REVOKED') then
    raise exception 'Wallet pass still active after anonymization';
  end if;
  if not exists (select 1 from public.wallet_passes where customer_id = target) then
    raise exception 'Customer history was lost';
  end if;
  if (select count(*) from public.audit_logs
      where action = 'CUSTOMER_ANONYMIZED' and entity_id = target) <> 1 then
    raise exception 'Anonymization was not audited exactly once';
  end if;
  if exists (select 1 from public.audit_logs
      where action = 'CUSTOMER_ANONYMIZED' and entity_id = target
        and metadata::text ~ '(8100000082|anon82|Para Anonimizar)') then
    raise exception 'Audit metadata carries personal data';
  end if;
end;
$$;
