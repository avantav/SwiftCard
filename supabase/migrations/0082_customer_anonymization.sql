-- ARCO cancellation for customers with history (DEC-0075).
--
-- app.delete_admin_customer only deletes customers without history. A customer
-- who asks for cancellation after buying keeps their purchases, rewards and
-- ledger (the business needs them for its accounting and statistics), but every
-- identifying field is removed and their cards and Wallet passes stop working.
--
-- * Only an active Admin general of an active tenant may anonymize.
-- * Atomic: one transaction locks the customer row and updates everything.
-- * Audited with CUSTOMER_ANONYMIZED; the audit metadata carries no personal data.
-- * Irreversible: an anonymized customer cannot be anonymized again.

alter table public.customers
  add column anonymized_at timestamptz;

-- Once anonymized, a customer row is frozen: no reactivation, no new personal
-- data and no new marketing consent through any application path.
create function app.prevent_anonymized_customer_changes()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if old.anonymized_at is not null and (
    new.anonymized_at is distinct from old.anonymized_at
    or new.status is distinct from old.status
    or new.full_name is distinct from old.full_name
    or new.normalized_phone is distinct from old.normalized_phone
    or new.email is distinct from old.email
    or new.birth_date is distinct from old.birth_date
    or new.marketing_consent is distinct from old.marketing_consent
  ) then
    raise exception 'customer_anonymized' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger customers_prevent_anonymized_changes
before update on public.customers
for each row execute function app.prevent_anonymized_customer_changes();

create function app.anonymize_admin_customer(target_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  customer_record record;
  placeholder_phone text;
  revoked_cards integer;
  revoked_passes integer;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select customer.* into customer_record
  from public.customers customer
  where customer.id = target_customer_id
    and customer.tenant_id = staff_record.tenant_id
  for update;

  if staff_record.id is null or customer_record.id is null then
    return 'UNAVAILABLE';
  end if;
  if customer_record.anonymized_at is not null then
    return 'ALREADY_ANONYMIZED';
  end if;

  -- The phone column is NOT NULL, E.164 and unique per tenant. «+999» is not
  -- an assignable country code, so the placeholder can never match a real
  -- registration; 12 digits come from the customer id to keep it unique.
  placeholder_phone := '+999' || lpad(
    (('x' || substr(replace(customer_record.id::text, '-', ''), 1, 10))::bit(40)::bigint % 1000000000000)::text,
    12, '0');

  update public.customers set
    full_name = 'Cliente anonimizado',
    normalized_phone = placeholder_phone,
    email = null,
    birth_date = null,
    marketing_consent = false,
    marketing_consent_at = null,
    marketing_consent_source = null,
    status = 'INACTIVE',
    anonymized_at = now(),
    updated_at = now()
  where id = customer_record.id;

  update public.customer_cards set status = 'REVOKED', revoked_at = now()
  where customer_id = customer_record.id and status <> 'REVOKED';
  get diagnostics revoked_cards = row_count;

  -- Wallet devices stop receiving updates; their push registrations go away.
  delete from public.apple_wallet_registrations registration
  using public.wallet_passes pass
  where registration.wallet_pass_id = pass.id
    and pass.customer_id = customer_record.id;
  delete from public.apple_wallet_update_outbox outbox
  using public.wallet_passes pass
  where outbox.wallet_pass_id = pass.id
    and pass.customer_id = customer_record.id;
  update public.wallet_passes set status = 'REVOKED', last_error = null
  where customer_id = customer_record.id and status <> 'REVOKED';
  get diagnostics revoked_passes = row_count;

  -- Pending promotional deliveries must not go out.
  update public.marketing_campaign_recipients set status = 'SKIPPED'
  where customer_id = customer_record.id and status = 'PENDING';

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'CUSTOMER_ANONYMIZED',
    'customers', customer_record.id,
    jsonb_build_object(
      'previous_status', customer_record.status::text,
      'revoked_cards', revoked_cards,
      'revoked_wallet_passes', revoked_passes
    )
  );

  return 'ANONYMIZED';
end;
$$;

revoke all on function app.anonymize_admin_customer(uuid) from public, anon, authenticated;
grant execute on function app.anonymize_admin_customer(uuid) to authenticated;
