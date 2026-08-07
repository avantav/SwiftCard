-- Atomically registers a customer from an active public branch token.

create or replace function app.register_public_customer(
  target_branch_token text,
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
  customer_id_value uuid;
  card_token_value text;
begin
  if not target_privacy_consent
    or nullif(btrim(target_branch_token), '') is null
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return query select 'INVALID'::text, null::text;
    return;
  end if;

  select b.id, b.tenant_id
    into branch_record
  from public.branches b
  join public.tenants t on t.id = b.tenant_id
  where b.public_registration_token = target_branch_token
    and b.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if not found then
    return query select 'UNAVAILABLE'::text, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.customers c
    where c.tenant_id = branch_record.tenant_id
      and c.normalized_phone = target_normalized_phone
  ) then
    return query select 'DUPLICATE'::text, null::text;
    return;
  end if;

  begin
    insert into public.customers (
      tenant_id,
      full_name,
      normalized_phone,
      email,
      birth_date,
      privacy_consent,
      registration_method,
      source_branch_id
    ) values (
      branch_record.tenant_id,
      btrim(target_full_name),
      target_normalized_phone,
      nullif(lower(btrim(target_email)), ''),
      target_birth_date,
      target_privacy_consent,
      'SELF_SERVICE',
      branch_record.id
    ) returning id into customer_id_value;

    insert into public.customer_cards (tenant_id, customer_id)
    values (branch_record.tenant_id, customer_id_value)
    returning public_token into card_token_value;
  exception
    when unique_violation then
      return query select 'DUPLICATE'::text, null::text;
      return;
  end;

  return query select 'CREATED'::text, card_token_value;
end;
$$;

revoke all on function app.register_public_customer(text, text, text, text, date, boolean)
from public, authenticated;
grant execute on function app.register_public_customer(text, text, text, text, date, boolean)
to anon;
grant usage on schema app to anon;
