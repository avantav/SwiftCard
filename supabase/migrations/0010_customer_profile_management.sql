-- Backend-protected customer editing and deactivation for Admin and Manager.

create or replace function app.update_customer_profile(
  target_customer_id uuid,
  target_full_name text,
  target_normalized_phone text,
  target_email text,
  target_birth_date date,
  target_status public.customer_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  customer_record record;
  can_manage boolean;
begin
  select c.id, c.tenant_id, c.source_branch_id
    into customer_record
  from public.customers c
  where c.id = target_customer_id;

  if not found or not app.current_staff_is_active() or not app.current_tenant_is_active() then
    return 'UNAVAILABLE';
  end if;

  can_manage := app.current_staff_can_manage_tenant(customer_record.tenant_id)
    or (app.current_staff_role() = 'MANAGER'
      and app.current_staff_can_access_branch(customer_record.source_branch_id));

  if not can_manage
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return 'UNAVAILABLE';
  end if;

  begin
    update public.customers
    set full_name = btrim(target_full_name),
        normalized_phone = target_normalized_phone,
        email = nullif(lower(btrim(target_email)), ''),
        birth_date = target_birth_date,
        status = target_status
    where id = target_customer_id;
  exception when unique_violation then
    return 'DUPLICATE';
  end;

  return 'UPDATED';
end;
$$;

revoke all on function app.update_customer_profile(uuid, text, text, text, date, public.customer_status)
from public, anon;
grant execute on function app.update_customer_profile(uuid, text, text, text, date, public.customer_status)
to authenticated;
