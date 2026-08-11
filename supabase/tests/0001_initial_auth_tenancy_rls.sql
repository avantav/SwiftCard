\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'superadmin@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000011', 'admin-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000012', 'manager-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000013', 'employee-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000014', 'inactive-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000015', 'reset-required-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000021', 'admin-b@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000031', 'admin-suspended@swiftwallet.test');

insert into public.tenants (id, name, status) values
  ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'ACTIVE'),
  ('10000000-0000-0000-0000-000000000002', 'Tenant B', 'ACTIVE'),
  ('10000000-0000-0000-0000-000000000003', 'Tenant Suspended', 'SUSPENDED');

insert into public.branches (id, tenant_id, name) values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Tenant A - Branch 1'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Tenant A - Branch 2'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Tenant B - Branch 1'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    'Suspended - Branch 1'
  );

insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  (
    '00000000-0000-0000-0000-000000000001',
    null,
    'superadmin@swiftwallet.test',
    'Superadmin',
    'SUPERADMIN',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    'admin-a@swiftwallet.test',
    'Admin A',
    'ADMIN',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000001',
    'manager-a@swiftwallet.test',
    'Manager A',
    'MANAGER',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '10000000-0000-0000-0000-000000000001',
    'employee-a@swiftwallet.test',
    'Employee A',
    'EMPLOYEE',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    '10000000-0000-0000-0000-000000000001',
    'inactive-a@swiftwallet.test',
    'Inactive A',
    'EMPLOYEE',
    'INACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000015',
    '10000000-0000-0000-0000-000000000001',
    'reset-required-a@swiftwallet.test',
    'Reset Required A',
    'EMPLOYEE',
    'PASSWORD_RESET_REQUIRED'
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000002',
    'admin-b@swiftwallet.test',
    'Admin B',
    'ADMIN',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000003',
    'admin-suspended@swiftwallet.test',
    'Admin Suspended',
    'ADMIN',
    'ACTIVE'
  );

insert into public.staff_branch_assignments (
  tenant_id,
  staff_profile_id,
  branch_id,
  is_primary
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000002',
    true
  );

set role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  false
);

do $$
declare
  visible_tenants integer;
  visible_branches integer;
  visible_staff integer;
begin
  select count(*) into visible_tenants from public.tenants;
  select count(*) into visible_branches from public.branches;
  select count(*) into visible_staff from public.staff_profiles;

  if visible_tenants <> 1 then
    raise exception 'Admin A expected 1 tenant, got %', visible_tenants;
  end if;

  if visible_branches <> 2 then
    raise exception 'Admin A expected 2 branches, got %', visible_branches;
  end if;

  if visible_staff <> 5 then
    raise exception 'Admin A expected 5 tenant staff profiles, got %', visible_staff;
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  update public.tenants
  set name = 'Cross-tenant update'
  where id = '10000000-0000-0000-0000-000000000002';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Admin A updated Tenant B';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.branches (tenant_id, name)
    values ('10000000-0000-0000-0000-000000000002', 'Forbidden branch');

    raise exception 'Admin A inserted a branch into Tenant B';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  update public.branches
  set name = 'Cross-tenant branch update'
  where id = '20000000-0000-0000-0000-000000000003';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Admin A updated a branch from Tenant B';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.staff_branch_assignments (
      tenant_id,
      staff_profile_id,
      branch_id
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000001'
    );

    raise exception 'Cross-tenant staff assignment was accepted';
  exception
    when check_violation then
      null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000012',
  false
);

do $$
declare
  visible_branches integer;
begin
  select count(*) into visible_branches from public.branches;

  if visible_branches <> 1 then
    raise exception 'Manager A expected 1 assigned branch, got %', visible_branches;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000013',
  false
);

do $$
declare
  visible_branches integer;
begin
  select count(*) into visible_branches from public.branches;

  if visible_branches <> 1 then
    raise exception 'Employee A expected 1 assigned branch, got %', visible_branches;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000014',
  false
);

do $$
declare
  visible_branches integer;
begin
  select count(*) into visible_branches from public.branches;

  if visible_branches <> 0 then
    raise exception 'Inactive staff expected 0 branches, got %', visible_branches;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000015',
  false
);

do $$
declare
  visible_tenants integer;
  visible_branches integer;
begin
  select count(*) into visible_tenants from public.tenants;
  select count(*) into visible_branches from public.branches;

  if visible_tenants <> 0 or visible_branches <> 0 then
    raise exception
      'Password-reset-required staff expected no operational access, got % tenants and % branches',
      visible_tenants,
      visible_branches;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000031',
  false
);

do $$
declare
  visible_tenants integer;
  visible_branches integer;
begin
  select count(*) into visible_tenants from public.tenants;
  select count(*) into visible_branches from public.branches;

  if visible_tenants <> 0 or visible_branches <> 0 then
    raise exception
      'Suspended tenant admin expected no access, got % tenants and % branches',
      visible_tenants,
      visible_branches;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

do $$
declare
  visible_tenants integer;
  visible_branches integer;
begin
  select count(*) into visible_tenants from public.tenants;
  select count(*) into visible_branches from public.branches;

  if visible_tenants <> 3 or visible_branches <> 4 then
    raise exception
      'Superadmin expected 3 tenants and 4 branches, got % and %',
      visible_tenants,
      visible_branches;
  end if;
end;
$$;

reset role;

select 'RLS assertions passed' as result;
