# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last completed feature: per-tenant Apple Wallet `storeCard` design and on-demand signed `.pkpass` generation.
3. Migration state: the user reports `0035` applied; new migration `0036_apple_wallet_tenant_designs.sql` is local and must not be pushed remotely without explicit release approval.
4. Admin route: `/admin/wallet` is Admin-general-only and provides activation, accessible colors, text, HTTPS image inputs, version state, and live preview.
5. Public route: `/api/wallet/apple/[cardToken]` derives all authority from the card token and returns `application/vnd.apple.pkpass` only for active records, enabled design, and complete signing config.
6. Required server secrets: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_SIGNER_CERTIFICATE_BASE64`, `APPLE_SIGNER_KEY_BASE64`, `APPLE_WWDR_CERTIFICATE_BASE64`, optional `APPLE_CERTIFICATE_PASSWORD`, and `SWIFTWALLET_PUBLIC_URL`.
7. Asset security: Supabase's configured host is allowed automatically; other exact HTTPS hosts must be listed in `APPLE_WALLET_ASSET_HOSTS`.
8. Commands passed: `npm run lint`, `npm run typecheck`, 147 Vitest tests, `npm run db:verify-rls`, and `npm run build`.
9. Additional validation: Chrome review passed at 375, 768, 1280, and 1440 px; disposable certificates produced a signed `.pkpass` ZIP. Real Apple device acceptance was not possible without authorized credentials.
10. Immediate release step: review and apply `0036`, configure secrets in the deployment manager, enable a tenant design, then download from an active Web Card on iPhone/Mac.
11. Next feature step: implement Apple's device registration/update endpoints and APNs notifications so installed cards refresh after loyalty changes; Google Wallet remains pending.
12. External blockers: `WALLET-001` and `PILOT-001` remain active.
13. Security risk: `npm audit --omit=dev` still reports four high advisories in existing Next.js transitive packages and `xlsx`; the Apple dependency's Joi advisory is mitigated by the package override.
14. Continue only with additive migrations after `0036`; never modify an applied migration.
