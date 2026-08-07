-- Phase 7: atomic confirmation of validated customer imports.

create or replace function public.confirm_customer_import(
  target_import_id uuid,
  target_branch_id uuid,
  valid_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  import_record public.customer_imports%rowtype;
  branch_tenant_id uuid;
  row_value jsonb;
  phone_value text;
  customer_id uuid;
  imported_count integer := 0;
  duplicate_count integer := 0;
  row_count integer := 0;
begin
  if not app.is_superadmin() then raise exception 'superadmin required' using errcode = '42501'; end if;
  select * into import_record from public.customer_imports where id = target_import_id for update;
  if not found or import_record.status <> 'PREVIEWED' then raise exception 'import must be previewed' using errcode = '23514'; end if;
  select tenant_id into branch_tenant_id from public.branches where id = target_branch_id and status = 'ACTIVE';
  if branch_tenant_id is distinct from import_record.tenant_id then raise exception 'branch does not belong to import tenant' using errcode = '23514'; end if;
  if jsonb_typeof(valid_rows) <> 'array' then raise exception 'valid rows must be an array' using errcode = '22023'; end if;

  for row_value in select value from jsonb_array_elements(valid_rows) loop
    row_count := row_count + 1;
    phone_value := row_value->>'normalized_phone';
    if phone_value is null or length(phone_value) = 0 then raise exception 'normalized phone required' using errcode = '22023'; end if;
    if exists (select 1 from public.customers c where c.tenant_id = import_record.tenant_id and c.normalized_phone = phone_value) then
      duplicate_count := duplicate_count + 1;
      continue;
    end if;
    insert into public.customers (tenant_id, full_name, normalized_phone, email, birth_date, privacy_consent, registration_method, source_branch_id)
      values (import_record.tenant_id, btrim(row_value->>'full_name'), phone_value, nullif(btrim(row_value->>'email'), ''), nullif(row_value->>'birth_date', '')::date, false, 'SELF_SERVICE', target_branch_id)
      returning id into customer_id;
    insert into public.customer_cards (tenant_id, customer_id) values (import_record.tenant_id, customer_id);
    insert into public.customer_loyalty_balances (tenant_id, customer_id, stamp_balance)
      values (import_record.tenant_id, customer_id, greatest(coalesce((row_value->>'initial_stamps')::integer, 0), 0));
    insert into public.stamp_ledger (tenant_id, customer_id, entry_type, stamps_delta, balance_after, reason)
      values (import_record.tenant_id, customer_id, 'ADJUSTMENT', greatest(coalesce((row_value->>'initial_stamps')::integer, 0), 0), greatest(coalesce((row_value->>'initial_stamps')::integer, 0), 0), 'Importación inicial');
    imported_count := imported_count + 1;
  end loop;

  update public.customer_imports set status = 'CONFIRMED', imported_rows = imported_count, duplicate_rows = duplicate_count, error_rows = total_rows - row_count, updated_at = now() where id = target_import_id;
  return jsonb_build_object('imported', imported_count, 'duplicates', duplicate_count, 'errors', total_rows - row_count);
end;
$$;

revoke all on function public.confirm_customer_import(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_customer_import(uuid, uuid, jsonb) to authenticated;
