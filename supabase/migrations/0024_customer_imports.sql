-- Phase 7 foundation: Superadmin customer import files and normalized upload rows.

create type public.customer_import_status as enum ('UPLOADED', 'PREVIEWED', 'CONFIRMED', 'FAILED');

create table public.customer_imports (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_name text not null,
  file_type text not null,
  file_size_bytes integer not null,
  status public.customer_import_status not null default 'UPLOADED',
  raw_rows jsonb not null default '[]'::jsonb,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  uploaded_by uuid not null references public.staff_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_imports_file_name_not_blank check (length(btrim(file_name)) > 0),
  constraint customer_imports_file_type_allowed check (file_type in ('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel')),
  constraint customer_imports_file_size_positive check (file_size_bytes > 0),
  constraint customer_imports_rows_array check (jsonb_typeof(raw_rows) = 'array'),
  constraint customer_imports_counts_nonnegative check (total_rows >= 0 and imported_rows >= 0 and duplicate_rows >= 0 and error_rows >= 0),
  constraint customer_imports_count_consistency check (imported_rows + duplicate_rows + error_rows <= total_rows)
);

create index customer_imports_tenant_created_idx on public.customer_imports (tenant_id, created_at desc);
create index customer_imports_uploaded_by_idx on public.customer_imports (uploaded_by);

create trigger customer_imports_set_updated_at
  before update on public.customer_imports
  for each row execute function app.set_updated_at();

alter table public.customer_imports enable row level security;
alter table public.customer_imports force row level security;

create policy customer_imports_superadmin_all
  on public.customer_imports for all to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

revoke all on public.customer_imports from anon;
grant select, insert, update on public.customer_imports to authenticated;
