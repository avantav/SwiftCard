-- Phase 7: persist column mapping and validation preview results.

alter table public.customer_imports
  add column mapped_columns jsonb not null default '{}'::jsonb,
  add column preview_errors jsonb not null default '[]'::jsonb;

alter table public.customer_imports
  add constraint customer_imports_mapping_object check (jsonb_typeof(mapped_columns) = 'object'),
  add constraint customer_imports_preview_errors_array check (jsonb_typeof(preview_errors) = 'array');
