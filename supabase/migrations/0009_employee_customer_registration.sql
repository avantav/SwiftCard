-- Atomic employee registration. Tenant and creator are derived from auth.uid().

create or replace function app.register_employee_customer(
  target_branch_id uuid,
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
  staff_record record;
  customer_id_value uuid;
  card_token_value text;
begin
  select sp.id, sp.tenant_id, sp.status, sp.role, t.status as tenant_status
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid();

  if not found
    or staff_record.status <> 'ACTIVE'
    or staff_record.tenant_status <> 'ACTIVE'
    or staff_record.role not in ('ADMIN', 'MANAGER', 'EMPLOYEE')
    or not exists (
      select 1 from public.branches b
      where b.id = target_branch_id and b.status = 'ACTIVE'
    )
    or not app.current_staff_can_access_branch(target_branch_id)
    or not target_privacy_consent
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return query select 'UNAVAILABLE'::text, null::text;
    return;
  end if;

  if exists (
    select 1 from public.customers c
    where c.tenant_id = staff_record.tenant_id
      and c.normalized_phone = target_normalized_phone
  ) then
    return query select 'DUPLICATE'::text, null::text;
    return;
  end if;

  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, email, birth_date,
      privacy_consent, registration_method, source_branch_id, created_by_staff_id
    ) values (
      staff_record.tenant_id, btrim(target_full_name), target_normalized_phone,
      nullif(lower(btrim(target_email)), ''), target_birth_date,
      true, 'EMPLOYEE', target_branch_id, staff_record.id
    ) returning id into customer_id_value;

    insert into public.customer_cards (tenant_id, customer_id)
    values (staff_record.tenant_id, customer_id_value)
    returning public_token into card_token_value;
  exception when unique_violation then
    return query select 'DUPLICATE'::text, null::text;
    return;
  end;

  return query select 'CREATED'::text, card_token_value;
end;
$$;

revoke all on function app.register_employee_customer(uuid, text, text, text, date, boolean)
from public, anon;
grant execute on function app.register_employee_customer(uuid, text, text, text, date, boolean)
to authenticated;
