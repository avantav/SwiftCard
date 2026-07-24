-- Customer phone values are stored in normalized international format.

alter table public.customers
  add constraint customers_normalized_phone_e164
  check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$');
