-- Phase 8: tenant-scoped Apple Wallet assets in Supabase Storage.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wallet-assets',
  'wallet-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy wallet_assets_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

create policy wallet_assets_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  )
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

create policy wallet_assets_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );
