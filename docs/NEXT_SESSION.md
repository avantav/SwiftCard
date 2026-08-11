# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Current feature: Apple Wallet automatic-update service implemented locally; production migration, credentials and end-to-end APNs validation remain.
3. Migration state: hosted Supabase is verified through `0037`; additive migration `0038_apple_wallet_updates.sql` exists and was validated only in disposable PostgreSQL. The user will apply it manually.
4. New pass metadata: every newly generated pass contains `webServiceURL`, stable per-pass `authenticationToken`, the existing serial and current `changeMessage` fields.
5. Public update base: `${SWIFTWALLET_PUBLIC_URL}/api/wallet/apple`; official `/v1` register, unregister, changed-serial, updated-pass and log endpoints are implemented.
6. Database security: device identifiers are keyed hashes, push tokens are AES-256-GCM ciphertext, update tables have forced RLS and no browser grants, and worker RPCs are `service_role` only.
7. Update authority: migration triggers queue changes to balances, rewards, customer/card state, program, reward tiers, Wallet design, branding and branch locations inside the same transaction.
8. Delivery mode: successful purchase, redemption, customer, program, design, branch and tenant actions attempt APNs immediately; failure never reverts the application operation and remains in the outbox.
9. APNs: production HTTP/2 endpoint, empty JSON payload, background push type, Pass Type topic, and the existing signer certificate/private key plus WWDR chain.
10. Invalid APNs device tokens remove their registrations. Successful device deliveries advance their update tag and avoid duplicate retry pushes.
11. Future retry path: `POST /api/internal/wallet/apple/process-updates` requires `Authorization: Bearer <APPLE_WALLET_RETRY_SECRET>` and processes up to 25 jobs. Connecting an external cron remains explicitly pending because Hostinger shared cron is not confirmed.
12. Required new secret: `APPLE_WALLET_UPDATE_SECRET_BASE64`, exactly 32 random bytes encoded as Base64. It is stable and must not be rotated directly.
13. Optional future scheduler secret: `APPLE_WALLET_RETRY_SECRET`, at least 32 random characters.
14. Existing Apple and Supabase secret names remain in `.env.example`; no secret is committed.
15. Important rollout: passes emitted before this work lack update metadata and must be removed from the iPhone and installed again after migration/deployment.
16. Validation completed: lint, typecheck, all 168 Vitest tests, production build, and the full disposable PostgreSQL/RLS suite including migration and test `0038`.
17. Deployment guide: `docs/APPLE_WALLET_UPDATES.md`.
18. Do not apply `0038` remotely; the user explicitly chose to apply it.
19. After deployment: reinstall pass, verify registration, register a stamp, verify APNs callbacks and updated `.pkpass`, then test generated/redeemed reward.
20. Remaining Phase 8 work: external retry cron, production APNs validation and Google Wallet.
