# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Latest feature: `/admin/customers` provides the Admin general an exclusive tenant-wide directory with name/phone search, status filtering, 50-row pagination, customer/card state, balance, available rewards, source branch, registration metadata and Apple Wallet diagnostics.
3. Customer-directory security: the navigation entry is Admin-only, the route redirects Managers before querying, every query uses the authenticated server client plus `context.tenantId`, and no service-role client or new migration is used.
4. Current Wallet state: Apple Wallet automatic updates are deployed far enough that production exposes the new `0038` schema, but new pass generation fails because `0038` revoked the sequence permission needed by the server insert.
5. Migration state: additive repair `0039_apple_wallet_service_sequence.sql` grants only `USAGE, SELECT` on `apple_wallet_update_tag_seq` to `service_role`. It is locally validated and the user will apply it manually.
6. New pass metadata: every newly generated pass contains `webServiceURL`, stable per-pass `authenticationToken`, the existing serial and current `changeMessage` fields.
7. Public update base: `${SWIFTWALLET_PUBLIC_URL}/api/wallet/apple`; official `/v1` register, unregister, changed-serial, updated-pass and log endpoints are implemented.
8. Database security: device identifiers are keyed hashes, push tokens are AES-256-GCM ciphertext, update tables have forced RLS and no browser grants, and worker RPCs are `service_role` only.
9. Update authority: migration triggers queue changes to balances, rewards, customer/card state, program, reward tiers, Wallet design, branding and branch locations inside the same transaction.
10. Delivery mode: successful purchase, redemption, customer, program, design, branch and tenant actions attempt APNs immediately; failure never reverts the application operation and remains in the outbox.
11. APNs: production HTTP/2 endpoint, empty JSON payload, background push type, Pass Type topic, and the existing signer certificate/private key plus WWDR chain.
12. Invalid APNs device tokens remove their registrations. Successful device deliveries advance their update tag and avoid duplicate retry pushes.
13. Future retry path: `POST /api/internal/wallet/apple/process-updates` requires `Authorization: Bearer <APPLE_WALLET_RETRY_SECRET>` and processes up to 25 jobs. Connecting an external cron remains explicitly pending because Hostinger shared cron is not confirmed.
14. Required new secret: `APPLE_WALLET_UPDATE_SECRET_BASE64`, exactly 32 random bytes encoded as Base64. It is stable and must not be rotated directly.
15. Optional future scheduler secret: `APPLE_WALLET_RETRY_SECRET`, at least 32 random characters.
16. Existing Apple and Supabase secret names remain in `.env.example`; no secret is committed.
17. Important rollout: passes emitted before this work lack update metadata and must be removed from the iPhone and installed again after migration/deployment.
18. Validation completed for the repair: lint, typecheck, all 173 Vitest tests, production build, and the full disposable PostgreSQL/RLS suite through migration/test `0039` passed.
19. Deployment guide: `docs/APPLE_WALLET_UPDATES.md`.
20. Do not apply `0039` remotely; the user explicitly chose to apply database migrations manually.
21. After applying `0039`: retry pass generation, reinstall the pass, verify registration, register a stamp, verify APNs callbacks and updated `.pkpass`, then test generated/redeemed reward.
22. Remaining Phase 8 work: external retry cron, production APNs validation and Google Wallet.
