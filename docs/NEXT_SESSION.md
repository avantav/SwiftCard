# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last completed feature: Admin-generated public registration links and downloadable QR codes per active branch.
3. Migration state: hosted Supabase was verified through `0037`; public registration QR sharing reuses existing branch tokens and requires no new migration.
4. Admin route: `/admin/wallet` is Admin-general-only and provides activation, accessible colors, direct PNG/JPEG/WebP uploads, version state, and live preview.
5. Public route: `/api/wallet/apple/[cardToken]` derives all authority from the card token and returns `application/vnd.apple.pkpass` only for active records, enabled design, and complete signing config.
6. Required server secrets: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_SIGNER_CERTIFICATE_BASE64`, `APPLE_SIGNER_KEY_BASE64`, `APPLE_WWDR_CERTIFICATE_BASE64`, optional `APPLE_CERTIFICATE_PASSWORD`, and `SWIFTWALLET_PUBLIC_URL`.
7. Asset security: migration `0037` creates public-read bucket `wallet-assets`; Admin writes are RLS-limited to generated `tenant_id/apple` paths, raster MIME types, and 5 MB. The configured Supabase host is allowed automatically; `APPLE_WALLET_ASSET_HOSTS` is only needed for additional external hosts.
8. Public registration distribution: `/admin/branches` uses `SWIFTWALLET_PUBLIC_URL` to copy/open each active branch link and download its QR; invalid/inactive links and suspended tenants do not render the form.
9. Commands passed: `npm run lint`, `npm run typecheck`, 157 Vitest tests, `npm run db:verify-rls`, and `npm run build`.
10. Additional validation: registration QR Chrome review passed at 375, 768, 1280, and 1440 px; authorized local credentials previously produced a signed `.pkpass` ZIP. Real Apple device acceptance remains pending.
11. Immediate release step: set `SWIFTWALLET_PUBLIC_URL` to the final Hostinger HTTPS origin, deploy the application, open `/admin/branches`, download a branch QR, and complete one real registration from a phone.
12. Next feature step: implement Apple's device registration/update endpoints and APNs notifications so installed cards refresh after loyalty changes; Google Wallet remains pending.
13. External blockers: `WALLET-001` and `PILOT-001` remain active.
14. Security risk: `npm audit --omit=dev` still reports four high advisories in existing Next.js transitive packages and `xlsx`; the Apple dependency's Joi advisory is mitigated by the package override.
15. Continue only with additive migrations after `0037`; never modify an applied migration.
