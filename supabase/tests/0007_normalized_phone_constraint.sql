\set ON_ERROR_STOP on

do $$
begin
  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, privacy_consent,
      registration_method, source_branch_id
    ) values (
      '10000000-0000-0000-0000-000000000001', 'Invalid Phone', '8111111111',
      true, 'SELF_SERVICE', '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'Unnormalized customer phone was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

insert into public.customers (
  tenant_id, full_name, normalized_phone, privacy_consent,
  registration_method, source_branch_id
) values (
  '10000000-0000-0000-0000-000000000001', 'Valid Phone', '+528122222222',
  true, 'SELF_SERVICE', '20000000-0000-0000-0000-000000000001'
);

select 'Normalized phone constraint assertions passed' as result;
