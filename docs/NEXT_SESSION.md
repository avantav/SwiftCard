# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Latest feature: the customer card now has one real opaque QR across the Web Card and Apple Wallet, and `/app/scan` reads it with the rear camera or manual fallback.
3. QR authority: only the existing `customer_cards.public_token` or its `/card/{token}` URL is encoded; the backend tenant-scoped scan RPC remains authoritative and no name, phone, UUID or balance enters the QR.
4. Current Wallet state: migration `0039` was applied manually and the user confirmed initial pass generation works again. The barcode/location persistence correction is local and awaits deployment plus real-device validation.
5. Scanner state: `@zxing/browser@0.1.5` with Node-compatible `@zxing/library@0.21.3` is route-scoped to the client scanner. Camera permission is explicit, environment-facing is preferred, and permission/device/offline failures retain manual input.
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
17. Important rollout: existing passes may lack update metadata or the corrected visible barcode; refresh through PassKit after deployment or remove and reinstall before scanning.
18. Validation completed: lint, typecheck, all 176 Vitest tests and production build passed. QR and scanner views were visually reviewed at 375, 768, 1280 and 1440 px; temporary review routes were removed.
19. Deployment guide: `docs/APPLE_WALLET_UPDATES.md`.
20. No new database migration is required for the QR/scanner correction.
21. After deployment: open `/app/scan`, grant camera permission, scan the visible Apple Wallet QR, verify the correct customer, then register a stamp and verify APNs returns an updated `.pkpass`.
22. Remaining Phase 8 work: external retry cron, production APNs validation and Google Wallet.
