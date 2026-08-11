-- Restore the server-only sequence permission required when the Apple Wallet
-- issuance endpoint inserts a new wallet_passes row. Migration 0038 revoked
-- this permission while update_tag still uses nextval(...) as its default.

grant usage, select
on sequence public.apple_wallet_update_tag_seq
to service_role;

notify pgrst, 'reload schema';
