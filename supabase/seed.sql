-- Development-only seed. Never run this file against production.
-- Credentials: use the password shown below only in a disposable local project.
-- Dev password for all seeded accounts: SwiftWalletDev!2026

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  superadmin_id uuid := '00000000-0000-4000-8000-000000000001';
  admin_id uuid := '00000000-0000-4000-8000-000000000002';
  manager_id uuid := '00000000-0000-4000-8000-000000000003';
  employee_id uuid := '00000000-0000-4000-8000-000000000004';
  tenant_id uuid := '10000000-0000-4000-8000-000000000001';
  branch_id uuid := '20000000-0000-4000-8000-000000000001';
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (superadmin_id, 'superadmin@example.test', crypt('SwiftWalletDev!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
    (admin_id, 'admin@example.test', crypt('SwiftWalletDev!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
    (manager_id, 'manager@example.test', crypt('SwiftWalletDev!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'),
    (employee_id, 'employee@example.test', crypt('SwiftWalletDev!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.tenants (id, name, contact_email) values (tenant_id, 'SwiftWallet Demo', 'admin@example.test') on conflict (id) do nothing;
  insert into public.branches (id, tenant_id, name, address) values (branch_id, tenant_id, 'Sucursal Demo', 'Dirección de desarrollo') on conflict (id) do nothing;
  insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
    (superadmin_id, null, 'superadmin@example.test', 'Superadmin Demo', 'SUPERADMIN', 'ACTIVE'),
    (admin_id, tenant_id, 'admin@example.test', 'Administrador Demo', 'ADMIN', 'ACTIVE'),
    (manager_id, tenant_id, 'manager@example.test', 'Encargado Demo', 'MANAGER', 'ACTIVE'),
    (employee_id, tenant_id, 'employee@example.test', 'Empleado Demo', 'EMPLOYEE', 'ACTIVE')
  on conflict (id) do update set status = excluded.status;
  insert into public.staff_branch_assignments (tenant_id, staff_profile_id, branch_id, is_primary) values
    (tenant_id, manager_id, branch_id, true), (tenant_id, employee_id, branch_id, true)
  on conflict (staff_profile_id, branch_id) do nothing;
end $$;
