# Work Log

## 2026-08-12 - Resumable Multi-card Configuration

**Objective:** Let a tenant operate up to three distinct cards with their own reward programs, statistics and participating branches through one simple provider-neutral setup flow.

**Changes Made:** Added migrations `0043` and `0044` for the card aggregate, one-to-one programs, transactional three-card limit, forced RLS, branch assignments, durable step completion, safe legacy backfill and card-scoped registration, scanning, purchase, adjustment, Web Card and Apple Wallet projections. Added `/admin/cards` with per-card metrics and a four-stage program/design/locations/publication assistant. The design stage uses one saved model and an Apple/Android preview toggle; legacy Program and Apple-only design pages redirect to the new flow. Employee registration and purchase selectors use a restricted RPC and only show card/branch combinations available to that operator.

**Safety:** Draft creation and every save derive the tenant from the authenticated Admin. Published operations derive the program from the issued opaque card token and require the selected branch to participate. No frontend `tenant_id`, program, stamp count or reward count is authoritative. Existing tenants are backfilled into one published card without rewriting customer tokens or balances.

**Validation:** Typecheck, lint, all 192 Vitest tests, the webpack production build and the complete disposable PostgreSQL migration/RLS suite through `0044` pass. The wizard was reviewed at 375, 768, 1280 and 1440 px; all four stages remain visible on mobile, direct uploads remain contained and the temporary review route was removed.

**Next Action:** Apply `0043`/`0044` to hosted Supabase with explicit deployment approval, smoke-test the complete flow there and refresh an existing signed Apple pass.

## 2026-08-12 - Dynamic Apple Wallet Stamp Strip

**Objective:** Reproduce a physical graphical stamp card inside Apple Wallet and refresh it when the customer's backend balance changes.

**Research:** Apple's Wallet documentation confirms that pass images are packaged and signed server-side, an updated pass is a complete new `.pkpass` with the same pass type and serial number, and APNs only prompts the device to request it. Store-card strip artwork uses 375 × 144 with matching device scales. Current Pass Designer compatibility guidance also indicates that strip presentation can vary or be omitted on recent iOS and Apple Watch, so the graphic cannot be the only balance representation.

**Changes Made:** Added a bounded Sharp/SVG renderer that generates `strip.png`, `strip@2x.png` and `strip@3x.png` from the authoritative current balance and cycle goal. Earned circles repeat the tenant logo or use initials; empty circles use a distinct dashed treatment; an uploaded strip becomes a darkened background. Pass generation invokes this renderer for both initial issuance and update requests, while an auxiliary field preserves the exact textual balance. The Admin preview and image guidance now describe and visualize the generated overlay.

**Security And Correctness:** No browser-provided stamp value or customer-specific image is trusted or persisted. The existing server-only source loader derives tenant, customer, balance and program, and the existing signed-pass/APNs path delivers the replacement. Generation is capped at 24 indicators and three fixed image sizes.

**Design Review:** The generated 375 × 144 PNG was inspected with six of ten branded circles. The Admin preview was reviewed at 375, 768, 1280 and 1440 px without horizontal overflow, hidden controls or loss of the textual fallback; temporary artifacts were removed.

**Validation:** Focused renderer, payload and integration tests, `npm run lint`, `npm run typecheck`, all 189 Vitest tests and the production webpack build pass. Authorized ignored local Apple credentials produced a valid signed `.pkpass` ZIP containing all three generated strip assets, their manifest hashes, a signature and exact textual fallback in `pass.json`; no secret or validation route remains in the repository.

**Migration:** None required.

## 2026-08-12 - Branded Graphical Web Card Stamps

**Objective:** Replace the Web Card's visible numeric stamp counter with a graphical loyalty-card treatment that fills with the tenant's identity.

**Changes Made:** Replaced the numeric ratio and progress bar with circular stamp positions. Earned positions use the tenant's primary color and repeat its logo; tenants without a logo use their initials. Normal goals render one position per stamp, while goals above 24 use a bounded proportional representation so an extreme configuration cannot create an unbounded DOM. Exact earned and goal values remain exposed as the graphical progress accessible name.

**Design Review:** The grid uses a maximum of five circles per row, distinguishes empty and earned positions by shape, fill and imagery rather than color alone, and keeps the existing Web Card hierarchy. The exact component was reviewed in Chrome at 375, 768, 1280 and 1440 px without overflow; the temporary review route was removed. Apple Wallet is unchanged because Apple controls its pass layout.

**Validation:** Focused application-design coverage, `npm run lint`, `npm run typecheck`, all 187 Vitest tests and the production webpack build pass.

**Migration:** None required.

## 2026-08-12 - Admin Program-Type Changes

**Objective:** Let the Admin general change an existing loyalty program without deleting or rewriting customer history.

**Changes Made:** Migration `0041` replaced the activity-based `TYPE_LOCKED` boundary. Because `0041` is already online, additive migration `0042` now converts balances without rewriting it. The Admin selector reveals a required confirmation and forces the transition save to `PAUSED`. Entering lifetime points atomically converts every nonzero current stamp balance with the configured points-per-stamp multiplier, clears obsolete monetary remainder, writes a `PROGRAM_CHANGE` ledger boundary and rejects overflow. Existing rewards remain untouched, historical purchases retain their original calculation rule/version, and dedicated audit events record both the type change and conversion. `0042` also repairs a switch completed during the rollout gap. Lifetime points remain unactivatable until their engine is implemented.

**Security Review:** The Server Action re-reads the current program through authenticated tenant RLS before accepting confirmation. The RPC continues to derive the active `ADMIN` and tenant from `auth.uid()`, rejects cross-tenant IDs, requires changed programs to be paused, and emits immutable audit data. Branch Administrators gain no new authority.

**Design Review:** The changed state uses the existing warning alert and native required checkbox, explains preservation and future scope before save, and keeps the status visibly paused. Exact representative states were reviewed at 375, 768, 1280 and 1440 px with no overflow and a 44px confirmation target; the temporary route was removed.

**Validation:** All 187 Vitest tests, `npm run lint`, `npm run typecheck`, the production webpack build and disposable PostgreSQL/RLS suite through `0042` pass. PostgreSQL coverage verifies the mandatory paused boundary, cyclic balance preservation, stamp-to-point multiplication, remainder clearing, completed-cycle and reward preservation, immutable historical purchase rule, per-customer ledger entry and audit metadata. The conversion state was reviewed at 375, 768, 1280 and 1440 px without overflow; its temporary route was removed.

**Migration:** `0040` and `0041` are confirmed online. Apply only `0042_stamp_to_point_balance_conversion.sql` for this change.

## 2026-08-12 - Apple Store-Card Preview Parity

**Objective:** Make the Admin Wallet mock represent the signed Apple `storeCard` as closely as a browser preview can.

**Research:** Reviewed Apple's current Wallet Human Interface Guidelines, Pass Designer guidance and store-card developer documentation. The supported hierarchy is logo/header, primary content over an optional strip, one combined row of up to four secondary and auxiliary fields, and a system-optimized barcode. The current strip specification is `375 × 144 pt`.

**Changes Made:** Rebuilt the mock with Apple-system typography, a correctly bounded logo, reward header field, stamp balance over the strip image, customer/meta supporting row and a realistic white QR block with alternate text. Updated image-upload guidance and changed generated strip assets from `375 × 123` to `375 × 144` plus matching 2x/3x sizes, so the mock and real `.pkpass` consume the same proportions.

**Design Review:** The exact preview component was inspected in Chrome at 375, 768, 1280 and 1440 px. Field order, image crop, text hierarchy and barcode remain visible without overflow; the preview explicitly explains that Apple retains control over typography, text fitting and device-specific cropping. The temporary review route was removed.

**Validation:** Focused Wallet tests, all 186 Vitest tests, `npm run lint`, `npm run typecheck` and the production webpack build passed. Regression coverage asserts the official strip dimensions, matching 2x/3x assets and preview structure.

**Migration:** None required. Existing saved source images are resized to the new dimensions the next time a pass is generated or updated.

## 2026-08-12 - Employee PWA Zoom Lock

**Objective:** Keep the installed employee PWA at a stable scale during scanning, customer selection, registration, purchases, redemptions and PIN unlock.

**Changes Made:** Added a route-specific viewport for `/app` with initial and maximum scale 1 plus user scaling disabled. Limited the PWA shell to horizontal and vertical pan gestures so pinch and double-tap cannot zoom, and fixed text inputs, selects and textareas at 16px to prevent iOS focus zoom. The root viewport remains unrestricted, so the Admin interface is unaffected.

**Design Review:** The restriction is scoped to `.operations-app`; checkbox, radio and hidden controls are excluded from the text-control sizing rule. Existing spacing, 48px primary actions, safe-area handling and responsive layouts are unchanged.

**Validation:** Focused PWA and application-design tests, `npm run lint`, `npm run typecheck`, all 185 Vitest tests and `npm run build` passed. Coverage asserts both the PWA restriction and the absence of scaling restrictions from the root layout.

**Migration:** None required.

## 2026-08-12 - Configurable Lifetime-Points Foundation

**Objective:** Make the third loyalty-program type visible and safely configurable from the Admin UI without changing existing cyclic programs or allowing an incomplete calculation mode to operate.

**Changes Made:** Added migration `0040` with explicit `STAMPS_PER_PURCHASE`, `STAMPS_PER_AMOUNT` and `LIFETIME_POINTS` types; backfilled existing programs; persisted custom singular/plural unit labels, welcome reward and import eligibility, integer stamp-to-point conversion, and purchase/reward cancellation plus redemption-reversal policies. Replaced the 10-tier product limit with an unbounded catalog whose individual fields remain bounded. Added an audited Admin-only save RPC and type locking after activity. Updated `/admin/program` with type-specific sections and a small interactive control that forces lifetime points to remain paused until its engine is implemented.

**Security Review:** The RPC derives the active Admin and tenant from `auth.uid()`, delegates existing program/tier persistence to the established tenant-scoped authority, rejects cross-tenant IDs, audits new options and grants no new anonymous or service-role browser access. Existing programs preserve their prior type and calculation. Lifetime points cannot be activated through either the browser or a direct authenticated RPC yet.

**Design Review:** The form uses the existing enterprise shell, sections, fields, alerts, checkboxes, reward editor and one primary action. Irrelevant calculation sections are hidden by the selected type, status is synchronized and keyboard-native, and screenshots at 375, 768, 1280 and 1440 px showed no overflow, hidden action or sub-44px critical mobile control. The temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 184 Vitest tests, `npm run build` and `npm run db:verify-rls` passed. PostgreSQL coverage verifies configuration persistence, audit attribution, catalogs above ten levels and type locking after activity.

**Next Action:** Implement tenths-based non-resetting balances, per-purchase truncation and one-time milestone generation; then add welcome/import generation, policy enforcement and Web Card/Apple Wallet progress before allowing `LIFETIME_POINTS` to become active.

## 2026-08-11 - Admin Branch Editing

**Objective:** Let the Admin general edit an existing branch without weakening tenant isolation or mixing general branch data with sensitive shared-access credentials.

**Changes Made:** Added inline editing to `/admin/branches` for name, address, coordinates, geofence radius, proximity activation/message and status. The server action validates every field, retains submitted values after failure, reports safe field/global errors, confirms deactivation, and dispatches already-queued Apple Wallet updates after a successful write. Access mode and shared credentials remain in their existing separate control.

**Security Review:** The action requires the active `ADMIN` internal area, derives the tenant from the authenticated context, validates the branch UUID, matches both branch ID and tenant ID, and remains subject to existing branch RLS. No service role, frontend tenant authority, secret, grant or migration was added. Cross-tenant branch update denial was added to the PostgreSQL RLS test.

**Design Review:** The editor reuses the existing branch record, disclosure, form, field, alert, badge and button patterns. Validation focuses an accessible summary and marks each invalid control; deactivation explains the impact before confirmation. Representative populated states were reviewed at 375, 768, 1280 and 1440 px with no horizontal overflow or hidden action; the temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 181 Vitest tests, `npm run build`, and `npm run db:verify-rls` passed. Focused coverage verifies normalization, multi-error reporting, safe persistence messages, accessible error handling, deactivation confirmation, authenticated tenant scoping and cross-tenant update denial.

**Migration:** None required. Existing branch RLS and Apple Wallet update triggers remain authoritative.

## 2026-08-10 - Customer QR Presentation And Camera Scanning

**Objective:** Make the customer's secure card QR visible and usable from Web Card or Apple Wallet through the employee PWA.

**Changes Made:** Replaced the Web Card's visual placeholder with a generated 512px PNG QR containing only the opaque public card token. Fixed the signed Apple pass by applying barcode and location properties through `PKPass.setBarcodes` and `PKPass.setLocations`; the library intentionally strips these method-owned properties from constructor props. Replaced the scan-page placeholder with explicit rear-camera capture using the Node-compatible `@zxing/browser@0.1.5`, automatic validated submission, stream cleanup, and manual input fallback.

**Security Review:** The QR contains no name, phone, UUID, tenant ID or balance. Both raw tokens and secure card URLs still resolve through the tenant-scoped backend RPC, so scanning another tenant's card reveals no customer data. Camera access starts only after a user action, scanning stops after success, offline submission is denied, and no frames are stored or uploaded.

**Design Review:** The real Web Card and scanner were reviewed at 375, 768, 1280 and 1440 px. The QR remains high-contrast with a quiet zone; the scanner uses one primary action, 48px controls, visible permission/error/status copy, mobile-safe sizing and a manual fallback. Temporary review routes were removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 176 Vitest tests, and `npm run build` passed. Focused tests cover QR PNG generation and token bounds, removal of the placeholder, PassKit barcode/location persistence, camera configuration, automatic submission, offline denial and manual fallback. `npm audit --omit=dev` reports five existing high-severity framework/export advisories; the ZXing packages are not in the advisory paths.

**Migration:** None required. The user confirmed previously pending migration `0039` is applied and initial Apple pass generation works.

**Next Action:** Deploy this commit, refresh or reinstall the Apple pass, scan it from `/app/scan` on the real employee phone, and then validate automatic stamp/reward refresh on iPhone.

## 2026-08-10 - Apple Wallet Initial-Issuance Permission Repair

**Objective:** Restore new Apple Wallet pass generation after deployment of migration `0038` without widening browser access.

**Changes Made:** Added additive migration `0039_apple_wallet_service_sequence.sql`. It grants only `USAGE` and `SELECT` on `apple_wallet_update_tag_seq` to `service_role`, which the server-side `wallet_passes` insert needs to generate its default `update_tag`. The disposable auth bootstrap now mirrors Supabase's privileged server role so the regression test executes the real insert boundary.

**Security Review:** `anon` and `authenticated` receive no sequence permission. A dedicated integration test inserts a new pass under `service_role`, verifies the generated tag, then confirms `authenticated` cannot use or advance the sequence. No RLS policy was disabled and no secret or frontend authority was added.

**Migration:** `0039` is additive and does not modify applied migration `0038`. Per user instruction it was not applied remotely.

**Validation:** `npm run lint`, `npm run typecheck`, all 173 Vitest tests, `npm run db:verify-rls`, and `npm run build` passed. The database suite includes a real pass insert under `service_role`, automatic update-tag allocation, and negative sequence checks for `authenticated`.

**Next Action:** Apply `0039` manually to production, then retry the Apple Wallet download. Once issuance succeeds, reinstall the pass and validate automatic stamp/reward updates on the real iPhone.

## 2026-08-10 - Admin Customer Directory

**Objective:** Give the Admin general a visible tenant-wide customer directory for diagnosing customer, card and Apple Wallet availability without exposing that administrative view to Branch Administrators.

**Changes Made:** Added `/admin/customers` with bounded name or normalized-phone search, ACTIVE/INACTIVE filtering, 50-row pagination, source branch, customer/card status, stamp balance, available rewards, registration metadata and Apple Wallet generation state. Added an Admin-only navigation entry, route-level loading state, explicit error/empty/no-result treatments and responsive table-to-record layouts.

**Security Review:** The route checks the active `ADMIN` permission before any data query. All reads use the authenticated server client and the tenant ID derived from the session; no service-role client, frontend tenant authority, public card token or new grant was introduced. Administradores de sucursal are redirected to `/admin` and do not receive the navigation item.

**Design Review:** The existing enterprise shell, filter panel, semantic table, textual state badges and approved tokens are reused. At the 375 and 768 layouts records become structured blocks without horizontal scrolling; 1280 and 1440 retain the compact table. Native controls and links retain keyboard focus, mobile actions reach 44px, and loading, error, initial-empty and filtered-empty states are explicit.

**Validation:** `npm run lint`, `npm run typecheck`, all 172 Vitest tests and `npm run build` passed. Focused coverage verifies filter bounds, phone normalization, pagination links, tenant-scoped queries, role enforcement and Admin-only navigation.

**Migration:** None required.

**Next Action:** Deploy the local commit, sign in as Admin general and open `/admin/customers` to confirm the newly registered customer's four availability signals before retrying the Apple Wallet download.

## 2026-08-10 - Apple Wallet Automatic Updates

**Objective:** Leave Apple Wallet automatic updates ready for deployment by adding device registration, authenticated updated-pass delivery, APNs notifications and durable non-blocking retries without requiring a confirmed Hostinger cron.

**Changes Made:** Added migration `0038` with monotonic update tags, hashed device identifiers, AES-256-GCM push-token ciphertext, many-to-many registrations, per-device delivered tags, a coalescing transactional outbox, RLS denial and service-role-only worker RPCs. Added the complete PassKit `/v1` web service, stable per-pass HMAC authentication, reusable current-pass projection, `If-Modified-Since` support, voiding for inactive cards, production HTTP/2 APNs delivery using the pass certificate, invalid-token cleanup, immediate scoped dispatch after loyalty/design mutations, and a Bearer-protected retry endpoint for a future scheduler.

**Security Review:** No frontend or request-provided tenant is authoritative. Registration requires the exact Pass Type ID, existing serial and constant-time `ApplePass` token validation. Device identifiers cannot be recovered from the database, push tokens require the stable server secret to decrypt, tables expose no browser grants, RPCs are restricted to `service_role`, request bodies and identifiers are bounded, and device logs are redacted. APNs failure never rolls back a purchase or redemption.

**Hosting Decision:** Hostinger shared supports Node.js but has no confirmed cron. Normal operations therefore attempt their own update immediately. Failed work remains durable and `/api/internal/wallet/apple/process-updates` is ready for an external scheduler. Connecting that scheduler remains documented as a production-scale pending item.

**Migration:** `0038_apple_wallet_updates.sql` was created and passed the full disposable PostgreSQL/RLS suite. Per user instruction it was not applied remotely; the user will apply it.

**Validation:** `npm run lint`, `npm run typecheck`, all 168 Vitest tests and `npm run build` passed. The full disposable PostgreSQL/RLS suite passed through migration and test `0038`, including registration idempotency, transactional queuing, tenant-wide coalescing, role denial, scoped claims, delivered tags, completion, unregister cleanup and suppression of work for uninstalled passes.

**Deployment Note:** A pass issued before this change lacks `webServiceURL` and `authenticationToken`; it must be removed and reinstalled after deployment. See `docs/APPLE_WALLET_UPDATES.md`.

**Next Action:** Review/apply `0038`, configure the environment and redeploy. Then reinstall the pass, validate a stamp and reward update on the real iPhone, and add the external cron.

## 2026-08-07 - Direct Apple Wallet Handoff After Registration

**Objective:** Remove the Web Card as the post-registration destination and let a newly registered customer add the signed pass directly to Apple Wallet.

**Changes Made:** The public registration success state now checks signer and tenant availability on the server and shows a generic Apple Wallet icon/button linked directly to the signed `.pkpass` endpoint. The previous “Abrir mi tarjeta” link was removed. When Wallet is unavailable, the customer sees a clear temporary-unavailability notice instead of a dead action. The Web Card route remains as a fallback and as the secure URL encoded inside the pass QR.

**Security Review:** The browser receives no signer configuration or tenant authority. Availability is checked through the existing bounded public RPC, and the pass endpoint still derives tenant, customer, card, design, balance, and program exclusively from the opaque card token. Only an exact `created=1` result renders the success handoff.

**Design Review:** The real success component passed Chrome review at 375, 768, 1280, and 1440 px. The black 58px action has a code-native generic Wallet icon, visible focus behavior, sufficient contrast, readable hierarchy, and no mobile overflow. The temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 162 Vitest tests, and `npm run build` passed. Focused tests verify direct pass routing, removal of the Web Card link, exact success-state handling, server-only signer/design availability, and existing Apple generation boundaries.

**Current Limitation:** Installed Apple passes do not yet refresh when stamps or rewards change. Automatic refresh still requires PassKit device-registration/update endpoints, APNs credentials and notifications, and updated-pass delivery.

**Next Action:** Deploy and perform one complete registration on an iPhone. After Apple accepts the initial pass, implement and validate the pending PassKit web service/APNs update flow.

## 2026-08-07 - Branch Creation Validation And Failure Diagnostics

**Objective:** Replace the generic “No se pudo crear la sucursal” response with complete field validation and an actionable, safe explanation of persistence failures.

**Changes Made:** Converted branch creation to action state so failed submissions retain name, address, coordinates, radius, mode, proximity, and shared email while always clearing passwords. Added structured validation for every applicable field, a focused error summary, inline errors, bounds and length guidance, and safe translations for RLS, expired sessions, missing migration/schema cache, connectivity, database constraints, duplicate system email, Auth email, and Auth password failures. Branch IDs are now generated on the trusted server before insertion, removing the unnecessary RLS-filtered `INSERT ... RETURNING` dependency while preserving compensation. Server logs identify the failure stage and provider code without logging form values or passwords.

**Security Review:** Tenant authority still comes exclusively from the authenticated Admin context. Raw database details are not returned to the browser, unknown errors expose only a provider code, and passwords are omitted from all returned action state and diagnostic logs. Existing compensation still deletes the new branch/Auth account when shared-account setup fails.

**Design Review:** The multi-error state passed Chrome review at 375, 768, 1280, and 1440 px. The summary receives programmatic focus, fields expose `aria-invalid` and linked descriptions, error contrast and borders are visible, controls remain at least 44px, and the temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 160 Vitest tests, and `npm run build` passed. Focused tests cover aggregation, field mapping, non-retention of passwords, safe migration/RLS/unknown-code explanations, and the accessible summary boundary.

**Next Action:** Deploy and repeat the failed branch submission. If the cause is migration/schema cache, the form will now identify migration `0035`; otherwise use the displayed diagnostic code and `[branch-create]` server log stage to resolve the exact provider rejection.

## 2026-08-07 - Public Branch Registration Links And QR Distribution

**Objective:** Let the Admin general generate and distribute a public self-service registration link and QR for every branch without introducing a second registration authority.

**Changes Made:** Added the active branch's tenant/branch context to the existing public registration page; invalid, inactive, or suspended destinations now stop before showing the form. `/admin/branches` now derives the public URL from the server-configured HTTPS origin, generates a 512px PNG QR, and provides copy, download, and open actions. Existing opaque branch tokens, source-branch attribution, duplicate handling, and atomic registration RPC remain unchanged; no migration was required.

**Security Review:** Only the Admin general sees distribution controls. The public context uses a server-only lookup and returns only tenant and branch names after active-status checks. Tenant, branch, customer, and card authority continue to be derived inside the existing database RPC; no frontend-provided identifier became authoritative.

**Design Review:** Chrome review passed at 375, 768, 1280, and 1440 px. The QR stays square and readable, the long URL remains contained, mobile actions use full-width 44px targets, status messages are announced, keyboard focus remains visible, and the temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 157 Vitest tests, and `npm run build` passed. Focused tests cover HTTPS-origin validation, minimal public context, Admin-only sharing, inactive branches, and PNG QR generation. `npm audit --omit=dev` found no QR-library advisory; the four existing runtime advisories remain tracked.

**Next Action:** Configure `SWIFTWALLET_PUBLIC_URL` with the final Hostinger HTTPS domain, deploy, download a branch QR from `/admin/branches`, and complete one registration from a physical phone.

## 2026-08-07 - Tenant-Scoped Apple Wallet Storage Uploads

**Objective:** Let the Admin general upload Apple Wallet logo and strip images directly from `/admin/wallet` while preserving tenant isolation and safe server-side pass generation.

**Changes Made:** Added migration `0037` with a public-read `wallet-assets` bucket, 5 MB PNG/JPEG/WebP limits, and Admin-only own-tenant Storage policies; replaced manual URL fields with direct authenticated uploads, pending/error/success states, live previews, replacement cleanup, and server validation of generated Supabase public URLs. The same-project Supabase hostname is now configured locally and remains automatically trusted by the pass generator.

**Security Review:** Storage writes require the active Admin general, the exact `tenant_id/apple` folder depth, and generated `logo`/`strip` filenames. Cross-tenant paths, Branch Administrators, invalid filenames, oversized files, unsupported MIME types, arbitrary submitted URLs, redirects, and invalid raster content are denied or safely ignored. The bucket is public only for non-sensitive brand-image reads; service-role credentials and signer secrets remain server-only.

**Design Review:** Chrome review passed at 375, 768, 1280, and 1440 px. The review found and fixed a browser-client prerender error plus horizontal file-input overflow at 375/768 px. Upload controls retain visible labels, status announcements, keyboard-native behavior, 44px targets, one primary save action, and no horizontal overflow. The temporary route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, all 151 Vitest tests, `npm run db:verify-rls`, and `npm run build` passed. Migration `0037` and its RLS assertions pass on disposable PostgreSQL 16. Authorized ignored local Apple credentials also produced a valid signed `.pkpass`; no secret was committed.

**Next Action:** Apply migrations `0036` and `0037` only with release approval, copy Apple secrets to the deployment manager, upload tenant assets, and validate the resulting pass on an Apple device.

## 2026-08-06 - Apple Wallet Tenant Design And Signed Pass Generation

**Objective:** Let each tenant design and distribute a loyalty card for Apple Wallet without exposing signing credentials or tenant authority to the browser.

**Changes Made:** Added migration `0036` with an Admin-only audited design RPC and anonymous availability check; added `/admin/wallet` with a live responsive `storeCard` preview; generated signed `.pkpass` files from public card tokens; included stamps, goals, rewards, terms, QR, and branch locations; recorded pass status; and added bounded, content-checked, allowlisted image processing with safe fallback assets.

**Security Review:** Service-role reads derive every identifier from the high-entropy card token, only active tenant/customer/card records can generate, signer material remains server-only, output is non-cacheable, remote assets require exact allowed hosts and a 5 MB/40 MP limit, and design writes remain Admin-only under RLS/RPC. The vulnerable Joi version pinned transitively by the signing package is overridden to `17.13.4`.

**Design Review:** The production designer was reviewed in Chrome at 375, 768, 1280, and 1440 px using representative data. Form, pending action, status, contrast rules, preview reflow, focus treatment, and 44px mobile targets comply with `docs/DESIGN_SYSTEM.md`; the temporary review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, 147 Vitest tests, `npm run db:verify-rls`, and `npm run build` passed. A disposable self-signed certificate test produced a valid signed `.pkpass` ZIP; real Apple acceptance remains blocked by credentials. Migration `0036` is local and unapplied remotely.

**Next Action:** Apply migration `0036` with release approval, configure Apple secrets and allowed asset hosts, then validate the pass on an Apple device before implementing registrations/APNs updates.

## 2026-08-06 - Branch Administrator And Shared PIN Access

**Objective:** Add the requested role hierarchy and optional branch-level shared employee login without losing individual operational attribution.

**Changes Made:** Preserved `MANAGER` as the compatible internal role and relabeled it Administrador de sucursal; allowed scoped employee/PIN management; added individual versus shared-PIN branch modes; compensated shared Auth provisioning; six-digit hashed PIN operators; five-attempt lockout; HttpOnly revocable operator sessions; explicit user switching; and PIN attribution on customers, purchases, ledger, redemptions, and audit logs.

**Security Review:** The shared JWT receives no direct branch access. RLS validates a per-device operator token forwarded only by the server from an HttpOnly cookie. PINs and raw session tokens are never persisted in plaintext, tenant/branch scope remains backend-derived, and account-level employee changes are denied when a Branch Administrator does not cover every assignment.

**Design Review:** PIN unlock and personal-management states were reviewed at 375, 768, 1280, and 1440 px. Forms reflow without horizontal overflow, critical controls retain 44px targets and visible labels, and the temporary visual-review route was removed.

**Validation:** `npm run lint`, `npm run typecheck`, 139 Vitest tests, `npm run db:verify-rls`, `npm run build`, and focused Chrome screenshots passed. Migration `0035` remains local and unapplied remotely.

**Next Action:** Resume the authorized correction controls and permission-scoped operational/audit history views.

## 2026-08-04 - Local Auth Cookie Header Recovery

**Objective:** Restore `/app` after Firefox showed a blank response and prove whether the failure occurred before or during application rendering.

**Cause:** Browser network evidence showed HTTP `431 Request Header Fields Too Large` with a request-cookie header above 16KB. Next rejected the request before middleware, route guards, RLS, or `/app` rendering could execute; this was not an empty React page.

**Changes Made:** Added one shared, application-specific `swiftwallet-auth` cookie name and enabled Supabase SSR's tokens-only cookie encoding consistently in browser, server, and middleware clients. This removes the duplicated user payload from session cookies and prevents SwiftWallet sessions from continuing under changing Supabase project-derived cookie names.

**Recovery Note:** Browsers that already contain the oversized localhost cookie set must clear site cookies once before the new configuration can receive a request and establish the smaller session.

**Security Review:** Tokens remain in the existing Supabase SSR cookie mechanism; tenant resolution, server-side `getUser()` validation, route guards, RLS, and sign-out behavior are unchanged. No secrets or session values were inspected or logged.

**Validation:** `npm run lint`, `npm run typecheck`, all 135 Vitest tests, `npm run build`, and `git diff --check` passed. Added focused checks requiring the same name and encoding across all three Supabase client boundaries. No migration is required.

**Next Action:** Implement the authorized Admin/Manager correction controls and permission-scoped operational/audit history views.

## 2026-08-04 - Collapsible Reward-Level Editor

**Objective:** Make the Admin “Agregar nivel” action visibly responsive and reduce the vertical cost of editing cumulative rewards.

**Files Created Or Modified:** Updated `src/components/reward-tiers-editor.tsx`, its shared styles in `src/app/globals.css`, the focused Admin program test, and continuity documentation.

**Changes Made:** Added compact per-level Editar/Ocultar controls with `aria-expanded` and associated field regions. Adding a level now collapses prior levels, expands the new one, scrolls it into view, focuses its stamp input, and shows a visible live confirmation. Tier fields are controlled so names and stamp summaries remain synchronized, and validation reveals the affected collapsed level.

**Design Checklist Review:** The editor keeps one clear add action, uses existing tokens, preserves 44px touch targets and visible focus, communicates expansion with text and ARIA rather than color, and compacts cleanly on mobile. No new visual dependency or page-specific visual language was introduced. Live interaction review remains with the user after the local server approval was declined.

**Validation:** `npm run lint`, `npm run typecheck`, all 133 Vitest tests, `npm run build`, and `git diff --check` passed. No database migration is required for this UI correction.

**Next Action:** Implement the authorized Admin/Manager correction controls and permission-scoped operational/audit history views.

## 2026-08-02 - Employee PWA Installation And Online-Only Runtime

**Objective:** Make the employee application installable as a home-screen shortcut on phones and tablets while preserving the MVP's online-only and multi-tenant security boundaries.

**Files Created Or Modified:** Expanded the App Router manifest and root metadata; added SwiftWallet 192px, 512px, maskable, and Apple touch icons; added `src/components/pwa-controller.tsx`, `public/sw.js`, `public/offline.html`, worker response headers, responsive PWA state styles, focused runtime tests, and continuity updates.

**Changes Made:** Added standalone identity, safe-area viewport handling, Android/Chromium launcher shortcuts and install action, Safari instructions for iPhone/iPad, installed-mode detection, an accessible live connection indicator, offline operational-submit blocking, and a branded cold-launch connection fallback. The icon set now matches the SwiftWallet enterprise brand mark and supports Android adaptive masks.

**Security And Product Boundary:** The worker caches only `/offline.html`. It does not cache authenticated routes, HTML application shells, tenant/customer data, Supabase requests, sessions, API responses, or queued operations. Navigation remains network-first and all business writes remain online and backend-authoritative. Worker updates bypass HTTP cache and `/sw.js` is served with no-store, MIME, CSP, and root-scope headers.

**Design Checklist Review:** The existing operational shell and hierarchy remain intact; connection state uses text plus color; install/offline states have semantic live regions; buttons retain visible focus and 44px touch targets; no gradient, glass, copied asset, or page-specific visual language was introduced. Exact production styles were reviewed at 375px and 768px, including install and connection-loss notices, and the temporary review route was removed.

**Validation:** Live `/manifest.webmanifest`, `/sw.js`, and `/offline.html` responses passed; PNG signatures and dimensions are tested; `npm run lint`, `npm run typecheck`, all 131 Vitest tests, `npm run build`, and `git diff --check` passed.

**Next Action:** Implement the authorized Admin/Manager correction controls and permission-scoped operational/audit history views.

## 2026-08-02 - Application-Wide Enterprise Design Rollout

**Objective:** Apply the mandatory SwiftWallet enterprise design system to every existing page beyond Superadmin without changing database authority, permissions, or business calculations.

**Files Created Or Modified:** Added shared enterprise, Administrator, PWA, brand, and public Web Card components; redesigned all current routes under `/admin`, `/app`, `/login`, `/change-password`, `/register`, `/card`, and `/`; consolidated exact design tokens and responsive patterns in `src/app/globals.css`; added application-wide design-contract tests and updated the Superadmin contract after navigation reuse.

**Changes Made:** Introduced a dark role-aware enterprise sidebar for Administrator/Manager, a mobile-first operational header and five-item bottom navigation, consistent page headers and contextual actions, compact metrics and semantic tables, structured operational lists, responsive forms, explicit success/error/empty/pending states, public authentication compositions, customer-registration success state, and a tenant-branded responsive Web Card.

**Security And Permission Review:** All protected layouts still call their existing server guards. Administrator-only navigation is omitted for Managers, customer editing is omitted for Employees, tenant authority remains server-derived, critical submit paths and RPCs are unchanged, and visible logout is available in every authenticated shell. No secrets or public card tokens were printed or committed.

**Design Checklist Review:** Tokens match `docs/DESIGN_SYSTEM.md`; one primary action is used per context; sidebar, mobile navigation, focus, touch targets, table mobile adaptation, reduced motion, semantic alerts, labels, headings, and captions were reviewed. Prohibited gradients, glassmorphism, ornamental shadows, and copied third-party assets are absent.

**Visual Review:** The populated Administrator UI was reviewed with a temporary authenticated session at 375, 768, 1280, and 1440 px; login was reviewed at 375 and 1440 px. The hosted project has no active Manager/Employee or customer card, so the exact PWA and Web Card components were rendered with temporary representative data at 375/768 px; review-only routes were removed immediately afterward.

**Validation:** `npm run lint`, `npm run typecheck`, all 127 Vitest tests, `npm run build`, and `git diff --check` passed.

**Next Action:** Implement permission-scoped correction controls and operational/audit history using the new shared shells and state patterns.

## 2026-08-02 - Superadmin Enterprise Control Center

**Objective:** Redesign the Superadmin experience under the mandatory SwiftWallet enterprise design system while preserving existing tenant operations and security boundaries.

**Files Created Or Modified:** Added the reusable Superadmin navigation, logout action, tenant-status control, and design-contract tests; redesigned the Superadmin overview and its tenant, Administrator, branding, upload, and mapping workflows; expanded shared design tokens and responsive component styles; updated continuity documents.

**Changes Made:** Introduced a 248px desktop sidebar and mobile navigation, active-route state, Superadmin identity and visible logout, restrained page hierarchy, one contextual primary action, live tenant/Administrator metrics, semantic responsive table, status and branding badges, protected status menu, explicit empty/error/success states, pending actions, keyboard focus treatment, reduced-motion support, and consistent child workflow cards.

**Security And Consistency Review:** Route authority remains server-derived through `requireInternalArea("SUPERADMIN")`; tenant status changes continue through the permission-checked PostgreSQL RPC and now require user confirmation; no service key or tenant authority reaches the browser. The implementation uses SwiftWallet assets and tokens only, with enterprise operational clarity as conceptual inspiration.

**Responsive And Accessibility Review:** Authenticated screenshots of the populated hosted tenant directory were reviewed at 375, 768, 1280, and 1440 px. Navigation collapses below desktop, metrics reflow, the table becomes a labeled mobile record, focus remains visible, table headers/caption remain semantic, and status feedback uses live-region roles.

**Validation:** `npm run lint` passed with one pre-existing `<img>` warning outside this scope; `npm run typecheck`, 122 Vitest tests, and `npm run build` passed. `git diff --check` passed.

**Next Action:** Build the authorized Admin/Manager correction and operational-history UI under the same design system.

## 2026-08-02 - Mandatory Enterprise Design System

**Objective:** Establish a professional, repository-owned UI standard inspired by the clarity and operational restraint of Verkada while preserving SwiftWallet's identity.

**Files Created Or Modified:** Added `docs/DESIGN_SYSTEM.md`; updated `AGENTS.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, and this work log.

**Changes Made:** Defined mandatory principles, application shells, spacing, colors, typography, borders, navigation, page headers, buttons, forms, tables, metrics, remote states, iconography, motion, responsive behavior, accessibility, content, implementation constraints, prohibited patterns, and a completion checklist. Added the design system to session startup, source-of-truth precedence, UI work cycles, and exception governance.

**Design Boundary:** Verkada is used only as conceptual inspiration for enterprise clarity, hierarchy, restraint, and efficiency. The rules explicitly prohibit copying Verkada branding, proprietary UI, text, logos, or visual assets.

**Validation:** Documentation structure and diff formatting reviewed with `git diff --check`.

**Next Action:** Redesign the Superadmin shell and overview using the new mandatory rules, then review it at the required responsive widths.

## 2026-08-02 - Hosted Supabase Development Setup

**Objective:** Bring up a safe hosted development database and prepare the first real UI review without running the direct-`auth.users` development seed.

**Files Created Or Modified:** Added the remote migration runner, compensated Superadmin bootstrap script, migration `0033_expose_app_api_schema.sql`, explicit custom-schema RPC routing, modern Supabase key-name compatibility, focused tests, and continuity updates.

**Changes Made:** Connected to a new Supabase PostgreSQL 17 project, verified it was empty, applied and tracked all 32 repository migration files through `0033`, exposed the permission-scoped `app` schema to PostgREST, routed `app.*` calls explicitly, added repeatable remote migration/bootstrap package commands, and verified both anonymous public-card RPC and elevated server-key access.

**Security And Consistency Review:** No secret values were printed or committed. `.env.local` remains ignored. The remote runner refuses an existing untracked SwiftWallet schema, applies each migration atomically, excludes `supabase/seed.sql`, and records migration versions. The bootstrap creates Auth first, compensates by deleting the Auth user if profile creation fails, and refuses to overwrite a non-Superadmin profile.

**Problems Encountered:** The current one-shot and pinned Supabase npm CLI executables both failed before database access because their packaged Bun runtime tried to access `/supabase/config.json`. The first live Data API check then exposed that existing code resolved `app.*` functions against `public` and that `app` was not exposed by PostgREST.

**Solution Applied:** Added a repository-owned `psql` migration runner with Supabase-compatible history, introduced additive migration `0033`, and changed application RPC calls to use `schema("app")` explicitly.

**Commands Executed:** Hosted read-only PostgreSQL checks, `npm run db:push:remote`, live Data API checks, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run db:verify-rls`, `npm run build`, `node --check`, and `git diff --check`.

**Results:** Remote database has 32 tracked migrations, 16 public application tables, 32 RLS policies, one confirmed active Superadmin, and zero tenants pending the first UI flow. Hosted Data API and `/api/health` checks pass, and `/login` returns HTTP 200. Disposable PostgreSQL RLS verification passes through `0033`; 118 Vitest tests, typecheck, and production build pass; lint has only the pre-existing Next `<img>` warning.

**Next Action:** Sign in to the live development UI with the generated Superadmin credentials, then create the first tenant and Administrator.

## 2026-07-30 - Admin Loyalty Program Configuration

**Objective:** Let a tenant Administrator create, configure, pause, and reactivate the MVP loyalty program without trusting tenant or stamp authority from the browser.

**Files Created Or Modified:** Added migration/test `0032_loyalty_program_creation.sql`, `src/lib/admin/program.ts` with focused tests, `/admin/program` page/action, Admin navigation, form styles, and continuity updates.

**Changes Made:** Added Admin-only, tenant-derived creation/configuration RPCs; one-program application guard; tenant-program and customer-balance locks; initial conversion of imported/pre-existing balances; program versioning; complete old/new audit metadata; currency-aware decimal-to-minor-unit validation; rule-specific normalization; safe failure when tenant/program reads fail; creation/edit/pause/reactivation UI; and pending-submit protection.

**Security And Consistency Review:** No `tenant_id` is accepted from the form or RPC. Both security-definer functions derive an active Admin and active tenant from `auth.uid()`, enforce the form's length/numeric/rule bounds again inside PostgreSQL, reject cross-tenant program IDs, revoke `public`/`anon`, serialize against balance mutations, and keep all reward generation inside the database transaction. The prior update RPC now delegates to the same secure path instead of remaining an alternate validation surface.

**Corrections During Review:** Focused validation initially exposed unsupported BigInt literal syntax, optional `Intl` precision typing, and a formatting-sensitive static assertion; all were corrected. The first SQL run exposed that an earlier test intentionally left Tenant B's Admin inactive, so this test now establishes its own active fixture. Final review added atomic conversion for balances imported before first-program creation, made the page fail closed when currency or program state cannot be loaded safely, enforced all input bounds in PostgreSQL, and routed the legacy update RPC through the hardened implementation.

**Commands Executed:** Focused program tests, `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, and `git diff --check`.

**Results:** Disposable PostgreSQL 16 passed all migrations/assertions through `0032`; 114 Vitest tests passed; typecheck and production build passed; lint passed with the pre-existing Next `<img>` warning.

**Next Action:** Expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by scoped operational/audit history views.

**Commit:** `73bdb9b feat: add admin loyalty program controls`.

## 2026-07-30 - Loyalty Correctness Hardening

**Objective:** Close backend loyalty gaps before building the operational Admin UI and E2E pilot path.

**Files Created Or Modified:** Added `supabase/migrations/0031_loyalty_correctness.sql`, `supabase/tests/0031_loyalty_correctness.sql`, and `src/lib/loyalty/correctness.test.ts`; updated the staff redemption page and continuity documents.

**Changes Made:** Enforced reward expiration at redemption, added a tenant-scoped expiration sweep, excluded overdue rewards from the public Web Card and staff selector, generated multiple rewards from positive adjustments, converted qualifying balances when an active reward goal is lowered, preserved remainders, persisted adjustment reward sources/counts, added program-change ledger boundaries, serialized program changes against balance mutations, stored reward cancellation reasons, and corrected reward/program audit actions.

**Security And Consistency Review:** All new RPC authority is derived from `auth.uid()` and the authenticated staff profile. Anonymous access remains limited to the public card projection. Security-definer functions explicitly revoke `public`/`anon` execution, tenant scope is derived server-side, customer balances remain advisory-locked, and no applied migration was edited.

**Corrections During Review:** The first integration-test revision declared one assertion variable in the wrong block; it was corrected and the full database suite rerun. A second review found that rejected paused-program purchases/positive adjustments could create empty balance rows after the concurrency reordering; program-state checks were moved before balance creation and a no-partial-persistence assertion was added.

**Commands Executed:** Focused Vitest correctness tests; `npm run db:verify-rls` repeatedly while refining the migration; `npm run lint`; `npm run typecheck`; `npm run test:run`; `npm run build`; and `git diff --check`.

**Results:** Disposable PostgreSQL 16 passed all migrations and SQL assertions through `0031`; 109 Vitest tests passed; typecheck and production build passed; lint passed with one pre-existing Next `<img>` warning.

**Next Action:** Implement Admin loyalty-program configuration and pause/resume controls, then expose the existing correction/history RPCs to authorized Admin and Manager users.

**Commit:** `218d592 fix: harden loyalty reward lifecycle`

## 2026-07-24 08:52 MST - Authenticated Root And Development Seed

**Objective:** Replace the root development menu with role-based navigation and add example users for a disposable Supabase project.

**Files Created Or Modified:** `src/app/page.tsx`, `supabase/seed.sql`, `src/lib/auth/home.test.ts`, and continuity docs.

**Changes Made:** Authenticated users now redirect to `/superadmin`, `/admin`, or `/app` from their role; password-reset-required users go to `/change-password`; anonymous users see login plus public routes. Added development-only Superadmin, Admin, Manager, and Employee seed accounts, demo tenant, branch, and assignments.

**Commands Executed:** `npm run typecheck`, focused home tests, `npm run lint`, `npm run build`, and `npm run test:run`.

**Results:** 106 tests passed; typecheck and build passed; lint passed with one pre-existing Next image warning. Build also passes without Supabase environment variables.

**Security Note:** Seed credentials are disposable development credentials only. Do not run `supabase/seed.sql` in production or reuse its password.

**Next Action:** Configure the local/Supabase environment, apply the development seed in a disposable project, and verify each seeded role reaches only its protected area.

**Commit:** Pending.

## 2026-07-24 03:31 MST - Phase 9 - Security Regression Suite

**Objective:** Add automated regression checks for secret and tenant-authority boundaries.

**Files Created Or Modified:** `src/lib/security/security-regression.test.ts` and continuity docs.

**Changes Made:** Added tests confirming service-role access remains server-only, the browser client does not reference the service key, `.env.example` contains no populated secret, and export tenant scope is derived from authenticated context.

**Commands Executed:** `npm run test:run`, `npm run lint`, `npm run typecheck`, and `npm run build`.

**Results:** 104 tests passed; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Execute the E2E pilot path when pilot information is available.

**Commit:** Pending.

## 2026-07-24 03:20 MST - Phase 9 - Production Readiness Documents

**Objective:** Add credential-free production checklist and monitoring/backup plan.

**Files Created Or Modified:** `docs/PRODUCTION_CHECKLIST.md`, `docs/MONITORING_BACKUP.md`, and continuity docs.

**Changes Made:** Documented deployment, security, privacy, migrations, RLS, backup restoration, monitoring, incident response, Wallet, and pilot sign-off checks. Marked production checklist and monitoring/backup plan complete; pilot remains blocked by missing external information.

**Commands Executed:** `git diff --check`.

**Results:** Documentation-only change; no runtime behavior changed.

**Next Action:** Resolve `WALLET-001` and `PILOT-001`, then execute the pilot E2E and release checklist.

**Commit:** Pending.

## 2026-07-24 03:12 MST - Phase 8 - Web Card Loyalty Fallback

**Objective:** Keep the public Web Card current while provider-specific Wallet generation is blocked.

**Files Created Or Modified:** `supabase/migrations/0030_public_web_card_loyalty.sql`, `supabase/tests/0030_public_web_card_loyalty.sql`, `src/app/card/[cardToken]/page.tsx`, `src/lib/customers/public-card.test.ts`, and continuity docs.

**Changes Made:** Extended the public projection with program name, stamp balance/goal, and available reward summaries. The projection continues to require active tenant/customer/card state and excludes private phone and internal identifiers.

**Commands Executed:** `npm run db:verify-rls`, `npm run typecheck`, focused public-card tests, `npm run build`, and `npm run test:run`.

**Results:** 102 tests passed; RLS passed through migration 0030; typecheck and build passed.

**Next Action:** Resolve `WALLET-001` before provider-specific pass generation; Web Card fallback is available meanwhile.

**Commit:** Pending.

## 2026-07-24 03:04 MST - Phase 8 - Wallet Credentials Blocker

**Objective:** Document provider credentials required for Apple/Google Wallet without storing secrets.

**Files Created Or Modified:** `.env.example`, `docs/IMPLEMENTATION_PLAN.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, `docs/BLOCKERS.md`, and continuity docs.

**Changes Made:** Added empty server-only environment names for Apple Pass Type ID, Team ID, certificate/password, Google Wallet Issuer ID, and service-account JSON. Marked credential documentation complete and recorded blocker `WALLET-001`.

**Commands Executed:** Repository environment-template inspection and `git diff --check`.

**Results:** No wallet secrets exist in the repository; provider generation remains blocked by missing authorized credentials.

**Next Action:** Resolve `WALLET-001` through the deployment secret manager, then implement provider-specific generation and update tests.

**Commit:** Pending.

## 2026-07-24 02:57 MST - Phase 8 - Wallet Foundation

**Objective:** Add a provider-neutral wallet pass schema and server-only service boundary without external credentials.

**Files Created Or Modified:** `supabase/migrations/0029_wallet_passes.sql`, `supabase/tests/0029_wallet_passes.sql`, `src/lib/wallet/pass.ts`, `src/lib/wallet/pass.test.ts`, and continuity docs.

**Changes Made:** Added tenant/customer/card-scoped pass records, provider/status enums, uniqueness constraints, read-only authenticated access, a provider-neutral payload builder, and server-only configuration checks for Apple and Google credentials. The dynamic Web Card remains the fallback.

**Commands Executed:** `npm run typecheck`, focused wallet tests, `npm run db:verify-rls`, `npm run lint`, `npm run test:run`, and `npm run build`.

**Results:** 101 tests passed; RLS passed through migration 0029; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Obtain external wallet credentials before provider-specific generation. The initial test run required splitting pure payload logic from the `server-only` configuration boundary; 101 tests now pass.

**Commit:** Pending.

## 2026-07-24 02:49 MST - Phase 7 - Tenant Branding Controls

**Objective:** Add Superadmin tenant branding mode and asset controls.

**Files Created Or Modified:** `supabase/migrations/0028_tenant_branding.sql`, `supabase/tests/0028_tenant_branding.sql`, tenant validation, Superadmin branding route/action, tenant navigation, tests, and continuity docs.

**Changes Made:** Added validated STANDARD/WHITE_LABEL mode, HTTPS-only logo and banner URLs, normalized hex colors, Superadmin-only branding RPC, and immutable audit event `TENANT_BRANDING_UPDATED`.

**Commands Executed:** `npm run typecheck`, focused tenant tests, `npm run db:verify-rls`, `npm run lint`, `npm run test:run`, and `npm run build`.

**Results:** 99 tests passed; RLS passed through migration 0028; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Close Phase 7 traceability and begin a credential-free Phase 8 Wallet foundation task.

**Commit:** Pending.

## 2026-07-24 02:42 MST - Phase 7 - Tenant Suspension Controls

**Objective:** Add Superadmin tenant listing, suspension, and reactivation controls.

**Files Created Or Modified:** `supabase/migrations/0027_tenant_suspension.sql`, `supabase/tests/0027_tenant_suspension.sql`, `src/app/superadmin/page.tsx`, `src/app/superadmin/tenants/actions.ts`, `src/lib/superadmin/tenants.test.ts`, and continuity docs.

**Changes Made:** Added the Superadmin-only `set_tenant_status` RPC, explicit ACTIVE/SUSPENDED transitions, audit records for both actions, tenant listing, and status controls in the Superadmin panel.

**Commands Executed:** `npm run typecheck`, focused tenant tests, `npm run db:verify-rls`, `npm run lint`, and `npm run build`.

**Results:** 97 tests; RLS passed through migration 0027; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Implement Superadmin branding mode controls with validation and audit coverage.

**Commit:** Pending.

## 2026-07-24 02:36 MST - Phase 7 - Import Confirmation

**Objective:** Confirm validated customer imports atomically with duplicate and error summary.

**Files Created Or Modified:** `supabase/migrations/0026_customer_import_confirmation.sql`, `supabase/tests/0026_customer_import_confirmation.sql`, import actions/mapping page, import tests, and continuity docs.

**Changes Made:** Added Superadmin-only `confirm_customer_import` RPC with import row locking, active-branch tenant verification, duplicate detection, atomic customer/card/balance/ledger creation, and persisted counts. Added branch selection and confirmation summary to the UI.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run db:verify-rls`, and `npm run build`.

**Results:** 96 tests passed; RLS passed through migration 0026; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Implement Superadmin tenant suspension and reactivation controls with status-transition tests.

**Commit:** Pending.

## 2026-07-24 02:31 MST - Phase 7 - Import Validation Preview

**Objective:** Validate mapped import rows without creating customer records.

**Files Created Or Modified:** `supabase/migrations/0025_customer_import_preview.sql`, `supabase/tests/0025_customer_import_preview.sql`, `src/lib/superadmin/imports.ts`, `src/lib/superadmin/imports.test.ts`, import actions and mapping page, and continuity docs.

**Changes Made:** Added persisted mapped columns and preview errors, server-side validation for name, normalized phone, email, ISO birth date, and nonnegative initial stamps, plus preview result rendering. Validation uses the existing phone normalization helper and does not mutate customers.

**Commands Executed:** `npm run typecheck`, focused import tests, `npm run lint`, `npm run build`, `npm run db:verify-rls`, and `npm run test:run`.

**Results:** 95 tests passed; RLS passed through migration 0025; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Implement atomic import confirmation with duplicate and error summary.

**Commit:** Pending.

## 2026-07-24 02:24 MST - Phase 7 - Import Parsing And Mapping

**Objective:** Parse uploaded CSV/XLSX files and expose detected columns for mapping.

**Files Created Or Modified:** `src/lib/superadmin/imports.ts`, `src/lib/superadmin/imports.test.ts`, `src/app/superadmin/imports/actions.ts`, `src/app/superadmin/imports/[importId]/mapping/page.tsx`, and continuity docs.

**Changes Made:** Added SheetJS parsing for CSV/XLS/XLSX, UTF-8 CSV handling, empty-row filtering, normalized object rows, a 5,000-row limit, persistence of parsed rows, and mapping selectors for name, phone, and optional email.

**Commands Executed:** `npm run typecheck`, focused import tests, `npm run lint`, `npm run test:run`, and `npm run build`.

**Results:** 94 tests passed; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Problems Found:** Initial CSV parsing corrupted accented headers; fixed by setting SheetJS codepage 65001 and added a regression test.

**Next Action:** Implement mapped validation preview without creating customer records.

**Commit:** Pending.

## 2026-07-24 02:18 MST - Phase 7 - Customer Import Upload

**Objective:** Add the Superadmin customer import schema and upload flow.

**Files Created Or Modified:** `supabase/migrations/0024_customer_imports.sql`, `supabase/tests/0024_customer_imports.sql`, `src/lib/superadmin/imports.ts`, `src/lib/superadmin/imports.test.ts`, Superadmin import pages/actions, and continuity docs.

**Changes Made:** Added Superadmin-only import history with file metadata, raw-row storage, counters, status, actor, tenant, and RLS. Added CSV/XLS/XLSX file validation, a 10 MB limit, tenant selection, upload registration, and a mapping continuation page.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run db:verify-rls`, and `npm run build`.

**Results:** 93 tests passed; RLS passed through migration 0024; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Next Action:** Parse uploads and implement server-side column mapping and validation preview without inserting customers.

**Commit:** Pending.

## 2026-07-24 02:05 MST - Phase 6 - XLSX Export Blocker

**Objective:** Verify whether XLSX export can be implemented with an existing approved dependency.

**Files Created Or Modified:** Continuity documentation files.

**Changes Made:** Confirmed no `xlsx`, `exceljs`, or `@sheetjs/xlsx` dependency is installed. Marked the XLSX task blocked and corrected continuity metadata to Phase 6, CSV completion, and 90 passing tests.

**Commands Executed:** `npm ls xlsx exceljs @sheetjs/xlsx --depth=0`, package script inspection, `git status`, `git branch --show-current`, and `git log --oneline -3`.

**Results:** No approved XLSX dependency is available. Existing CSV exports remain stable.

**Solution Applied:** Recorded blocker `XLSX-001` and an exact next action.

**Commit:** Pending.

## 2026-07-24 02:12 MST - Phase 6 - XLSX Exports

**Objective:** Add permission-scoped XLSX exports alongside CSV.

**Files Created Or Modified:** `package.json`, `package-lock.json`, `src/app/api/admin/exports/route.ts`, `src/app/admin/exports/page.tsx`, `src/lib/dashboard/export.test.ts`, and continuity docs.

**Changes Made:** Added `xlsx@0.18.5`, format validation, workbook generation, XLSX download headers, and an XLSX option in the Admin export form. XLSX reuses the existing allowlist, RLS-backed queries, branch filters, and date filters.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.

**Results:** 91 tests passed; typecheck and build passed; lint passed with one pre-existing Next image warning.

**Problems Found:** The first build exposed an invalid default import for `xlsx`; corrected to a namespace import and reran the full validation successfully.

**Solution Applied:** Closed blocker `XLSX-001` and marked Phase 6 exports complete.

**Commit:** Pending.

## 2026-07-24 01:58 MST - Phase 6 - CSV Exports

**Objective:** Add permission-scoped CSV exports for operational data.

**Files Created Or Modified:** `src/app/api/admin/exports/route.ts`, `src/app/admin/exports/page.tsx`, `src/lib/dashboard/export.test.ts`, Admin navigation, and continuity docs.

**Changes Made:** Added allowlisted server-side exports for customers, purchases, rewards, redemptions, adjustments, and summary metrics with date/sucursal filters. Tenant authority remains derived from the authenticated context and RLS.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** 90 Vitest tests passed; typecheck and build passed; lint passed with one existing Next.js external image warning. Build exposes `/admin/exports` and `/api/admin/exports`.

**Next Action:** Implement XLSX exports or document a dependency blocker.

## 2026-07-24 01:54 MST - Phase 6 - Branch Dashboard Comparison

**Objective:** Add branch comparison metrics to the scoped dashboard.

**Files Created Or Modified:** `supabase/migrations/0023_dashboard_branch_metrics.sql`, `supabase/tests/0023_dashboard_branch_metrics.sql`, `src/app/admin/dashboard/page.tsx`, `src/lib/dashboard/branch-metrics.test.ts`, and continuity docs.

**Changes Made:** Added branch-level customer, purchase, minor-unit amount, and stamp aggregates, constrained to Admin tenant scope or Manager assigned branches, with dashboard date filters.

**Commands Executed:** `npm run db:verify-rls`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0023; 89 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement XLSX exports or document a dependency blocker.

## 2026-07-24 01:51 MST - Phase 6 - Scoped Dashboard Metrics

**Objective:** Add dashboard metrics with tenant and assigned-branch permission filters.

**Files Created Or Modified:** `supabase/migrations/0022_dashboard_metrics.sql`, `supabase/tests/0022_dashboard_metrics.sql`, `src/lib/dashboard/metrics.test.ts`, `src/app/admin/dashboard/page.tsx`, the Admin navigation, and continuity docs.

**Changes Made:** Added role-scoped aggregate metrics for customers, purchases, minor-unit amounts, stamps, generated rewards, and redeemed rewards, with branch/date filters and a basic dashboard view.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0022; 88 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning. Build exposes `/admin/dashboard`.

**Next Action:** Add dashboard trends/branch comparisons and export boundaries.

## 2026-07-24 01:48 MST - Phase 5 - Reward Cancellation

**Objective:** Add Administrator-only cancellation of available rewards.

**Files Created Or Modified:** `supabase/migrations/0021_reward_cancellation.sql`, `supabase/tests/0021_reward_cancellation.sql`, `src/lib/loyalty/reward-cancellation.test.ts`, and continuity docs.

**Changes Made:** Added `cancel_reward` with Admin-only tenant authorization, AVAILABLE-state locking, no balance refund, and automatic audit event for cancellation.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0021; 87 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Begin Phase 6 scoped dashboard metrics and permission filters.

## 2026-07-24 01:46 MST - Phase 5 - Redemption Reversal And Adjustments

**Objective:** Add reward redemption reversal and manual stamp adjustments.

**Files Created Or Modified:** `supabase/migrations/0020_reversals_and_adjustments.sql`, `supabase/tests/0020_reversals_and_adjustments.sql`, `src/lib/loyalty/reversal.test.ts`, and continuity docs.

**Changes Made:** Added redemption lifecycle status and reversal metadata, Admin/Manager reversal authorization, reward re-availability, manual adjustment records with mandatory reason, balance locking, negative-balance rejection, ledger entries, and audit events.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0020; 86 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement Administrator-only reward cancellation without returning stamps.

## 2026-07-24 01:43 MST - Phase 5 - Purchase Cancellation

**Objective:** Add consistent purchase cancellation without editing financial history.

**Files Created Or Modified:** `supabase/migrations/0019_purchase_cancellation.sql`, `supabase/tests/0019_purchase_cancellation.sql`, `src/lib/loyalty/cancellation.test.ts`, and continuity docs.

**Changes Made:** Added Admin/Manager cancellation authorization, customer balance locking, later-activity protection, redeemed-reward protection, restoration of balance/remainder, cancellation ledger entry, available-reward cancellation, and audit trigger coverage.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0019; 85 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement redemption reversal and manual stamp adjustments.

## 2026-07-24 01:41 MST - Phase 5 - Immutable Audit Logs

**Objective:** Add append-only audit history and automatic sensitive-operation write paths.

**Files Created Or Modified:** `supabase/migrations/0018_audit_logs.sql`, `supabase/tests/0018_audit_logs.sql`, `src/lib/audit/audit.test.ts`, and continuity docs.

**Changes Made:** Added tenant/action/entity/actor audit records, mutation-blocking triggers, forced RLS, revoked direct inserts/updates/deletes, and automatic records for customer changes, purchases, and reward redemptions.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0018; 84 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement purchase cancellation with ledger and audit consistency.

## 2026-07-24 01:38 MST - Phase 4 - Geolocation And Submit Protection

**Objective:** Enforce strict/flexible location modes and prevent repeated mobile submissions.

**Files Created Or Modified:** `supabase/migrations/0017_geolocation_modes.sql`, `supabase/tests/0017_geolocation_modes.sql`, `src/components/submit-button.tsx`, purchase/redemption forms, and continuity docs.

**Changes Made:** Added tenant location mode and geofence validation triggers for purchases/redemptions. Added pending-state submit buttons while retaining database uniqueness/locking as the final duplicate protection.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0017; 83 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Begin Phase 5 immutable audit log schema and write paths.

## 2026-07-24 01:35 MST - Phase 4 - Employee Redemption Flow

**Objective:** Implement online reward redemption in the employee PWA.

**Files Created Or Modified:** `supabase/migrations/0016_reward_redemption.sql`, `supabase/tests/0016_reward_redemption.sql`, `src/app/app/redeem/page.tsx`, `src/app/app/redeem/actions.ts`, the employee app link, and continuity docs.

**Changes Made:** Added reward redemption history, an authenticated atomic redemption RPC, AVAILABLE-state locking, tenant/branch authorization, one-redemption uniqueness, and the `/app/redeem` interface.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0016; 83 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning. Build exposes `/app/redeem`.

**Next Action:** Implement geolocation modes and double-submit protection.

## 2026-07-24 01:32 MST - Phase 4 - Employee Purchase Flow

**Objective:** Connect scanner results to online purchase preview and confirmation.

**Files Created Or Modified:** `src/app/app/purchase/page.tsx`, `src/app/app/purchase/actions.ts`, `src/app/app/scan/actions.ts`, the employee app link, and continuity docs.

**Changes Made:** Added amount validation, online preview, ticket capture, confirmation, duplicate-ticket messaging, and backend-only stamp/reward results using the existing atomic RPCs.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** 83 Vitest tests passed; typecheck and build passed; lint passed with one existing Next.js external image warning. Build exposes `/app/purchase`.

**Next Action:** Implement online reward redemption.

## 2026-07-24 01:15 MST - Phase 4 - Employee Scanner

**Objective:** Add bounded QR parsing and tenant-validated card scanning to the employee PWA.

**Files Created Or Modified:** `src/app/app/scan/page.tsx`, `src/app/app/scan/actions.ts`, `src/lib/scanner/qr.ts`, scanner tests, `supabase/migrations/0015_staff_card_scan.sql`, `supabase/tests/0015_staff_card_scan.sql`, the employee app link, and continuity docs.

**Changes Made:** Added `/app/scan`, accepted only raw safe card tokens or `/card/...` URLs, and added an authenticated RPC that returns no customer data for unknown cards or cards belonging to another tenant.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0015; 83 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement online purchase and redemption mobile flows.

## 2026-07-24 01:12 MST - Phase 4 - PWA Manifest

**Objective:** Add install metadata for the employee PWA.

**Files Created Or Modified:** `src/app/manifest.ts`, `src/app/layout.tsx`, `public/icon.svg`, `src/lib/pwa/manifest.test.ts`, and continuity docs.

**Changes Made:** Added a generated standalone manifest with Spanish locale, `/app` start URL, theme/background colors, responsive viewport metadata, and a local SVG install icon. No credentials or tenant secrets are included.

**Commands Executed:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** 81 Vitest tests passed; typecheck and build passed; build exposes `/manifest.webmanifest`. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement the scanner route and QR parsing boundary.

## 2026-07-24 01:09 MST - Phase 3 - Loyalty Edge Cases

**Objective:** Complete multiple reward generation, pause behavior, and versioned rule changes.

**Files Created Or Modified:** `supabase/migrations/0013_purchase_operations.sql`, `supabase/tests/0013_purchase_operations.sql`, `supabase/tests/0014_program_changes.sql`, `src/lib/loyalty/program-changes.test.ts`, and continuity docs.

**Changes Made:** Added an Admin-only program update RPC that increments rule versions without resetting customer balances, verified amount-rule recalculation, verified multiple rewards from a single purchase, and blocked previews while the program is paused.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0014; 80 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Begin Phase 4 with PWA manifest and install metadata.

## 2026-07-24 01:05 MST - Phase 3 - Purchase Operations

**Objective:** Implement backend-only purchase preview and atomic confirmation.

**Files Created Or Modified:** `supabase/migrations/0013_purchase_operations.sql`, `supabase/tests/0013_purchase_operations.sql`, `src/lib/loyalty/purchase.test.ts`, and continuity docs.

**Changes Made:** Added preview and confirmation RPCs that derive staff/tenant/branch access, lock customer balances, calculate per-purchase or per-amount stamps and remainder, enforce duplicate tickets, insert purchases and ledger entries, and generate one or more rewards atomically.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0013; 79 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Test and implement multiple rewards, paused programs, and rule-change behavior.

## 2026-07-24 01:02 MST - Phase 3 - Loyalty Schema

**Objective:** Establish the Phase 3 data contract for programs, balances, purchases, ledger entries, and rewards.

**Files Created Or Modified:** `supabase/migrations/0012_loyalty_schema.sql`, `supabase/tests/0012_loyalty_schema.sql`, `src/lib/loyalty/schema.test.ts`, and continuity docs.

**Changes Made:** Added active-program uniqueness, per-purchase/per-amount rule configuration, minor-unit monetary columns, nonnegative stamp/remainder constraints, immutable purchase identity fields, ledger and reward structures, tenant consistency triggers, and forced RLS policies.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0012; 78 Vitest tests passed; typecheck and build passed. Lint passed with one existing Next.js external image warning.

**Next Action:** Implement atomic purchase preview and confirmation RPCs.

## 2026-07-24 00:59 MST - Phase 2 - Public Web Card

**Objective:** Implement the public Web Card route using a safe card-token projection.

**Files Created Or Modified:** `supabase/migrations/0011_public_web_card.sql`, `supabase/tests/0011_public_web_card.sql`, `src/app/card/[cardToken]/page.tsx`, `src/lib/customers/public-card.test.ts`, styles, and continuity docs.

**Changes Made:** Added an anonymous security-definer projection that requires an active card and tenant, returns only customer name and approved branding fields, and denies unknown or revoked tokens. Connected the route without displaying the raw token or database row.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** RLS passed through migration 0011; 77 Vitest tests passed; typecheck and build passed. Lint passed with one Next.js warning for the external logo `<img>` element.

**Next Action:** Begin Phase 3 loyalty schema and invariant tests.

## 2026-07-24 00:52 MST - Phase 2 - Customer Search And Profile Management

**Objective:** Add internal customer search plus protected editing and deactivation.

**Files Created Or Modified:** `supabase/migrations/0010_customer_profile_management.sql`, `supabase/tests/0010_customer_profile_management.sql`, `src/app/app/customers/page.tsx`, `src/app/app/customers/actions.ts`, the employee app link, and continuity docs.

**Changes Made:** Added search by partial name or exact normalized phone, an Administrator/Manager-only backend update RPC, duplicate-phone handling, and active/inactive status changes. RLS and tenant/branch checks remain authoritative in the database.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** All passed. RLS suite passed through migration 0010; Vitest passed with 76 tests; build completed with webpack.

**Next Action:** Implement the public web card route by card token with unknown/revoked-token denial tests.

## 2026-07-24 00:48 MST - Phase 2 - Employee Customer Registration

**Objective:** Implement employee customer registration with tenant and assigned-branch enforcement.

**Files Created Or Modified:** `supabase/migrations/0009_employee_customer_registration.sql`, `supabase/tests/0009_employee_customer_registration.sql`, `src/app/app/page.tsx`, `src/app/app/register/actions.ts`, `src/lib/customers/employee-registration.ts`, focused tests, and continuity docs.

**Changes Made:** Added an authenticated security-definer RPC deriving staff identity and tenant from `auth.uid()`, requiring an active assigned branch, and atomically creating the employee customer and card. Added the PWA registration form and duplicate/denied-branch handling.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** All passed. RLS suite passed through migration 0009; Vitest passed with 76 tests; build completed with webpack.

**Next Action:** Implement customer search and profile editing for Administrator and Encargado.

## 2026-07-24 00:43 MST - Phase 2 - Public Customer Registration

**Objective:** Implement secure self-service customer registration from an active branch token.

**Files Created Or Modified:** `supabase/migrations/0008_public_customer_registration.sql`, `supabase/tests/0008_public_customer_registration.sql`, `src/app/register/[branchToken]/actions.ts`, `src/app/register/[branchToken]/page.tsx`, `src/lib/customers/registration.test.ts`, `src/lib/customers/migrations.test.ts`, and continuity docs.

**Changes Made:** Added a security-definer RPC restricted to active branches and tenants, enforced consent and normalized-phone input, created customer/card records atomically, handled duplicate phones generically, and connected the public form to a server action using the anonymous Supabase client.

**Commands Executed:** `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

**Results:** All passed. RLS suite passed through migration 0008; Vitest passed with 73 tests; build completed with webpack.

**Next Action:** Implement employee registration with authenticated tenant and assigned-branch derivation.

## 2026-07-23 00:00 - Phase 0 - Repository Audit And Continuity Setup

**Objective:** Start autonomous SwiftWallet development from the provided MVP document and make the repository resumable.

**Files Created Or Modified**

- Created `docs/PRODUCT.md`.
- Created `AGENTS.md`.
- Created `docs/IMPLEMENTATION_PLAN.md`.
- Created `docs/PROJECT_STATUS.md`.
- Created `docs/WORK_LOG.md`.
- Created `docs/DECISIONS.md`.
- Created `docs/BLOCKERS.md`.
- Created `docs/NEXT_SESSION.md`.
- Created `docs/TRACEABILITY.md`.

**Changes Made**

- Inspected initial repository state.
- Confirmed the repository only contained `README.md` and the untracked `SwiftWallet_Documento_Maestro_MVP.md`.
- Created branch `codex/swiftwallet-mvp`.
- Normalized the master Markdown document into `docs/PRODUCT.md`.
- Created continuity documentation required for future sessions.

**Migrations Added**

- None.

**Tests Added Or Modified**

- None yet.

**Commands Executed**

- `git status --short`: passed; showed `SwiftWallet_Documento_Maestro_MVP.md` as untracked.
- `git branch --show-current`: passed; initial branch was `main`.
- `git log --oneline -10`: passed; latest commit was `5a45102 first commit`.
- `git switch -c codex/swiftwallet-mvp`: passed after escalation was approved.

**Problems Encountered**

- Creating a branch failed inside the sandbox because `.git` is read-only there.

**Solution Applied**

- Requested approval to run the Git branch creation outside the sandbox.

**Commit Generated**

- `3eb962b chore: initialize swiftwallet scaffold`

## 2026-07-24 00:32 MST - Phase 2 - Phone Normalization

**Objective:** Normalize customer phone numbers before duplicate checks and enforce the stored format in PostgreSQL.

**Files Created Or Modified**

- Created `src/lib/customers/phone.ts`.
- Created `src/lib/customers/phone.test.ts`.
- Created `supabase/migrations/0007_normalized_phone_constraint.sql`.
- Created `supabase/tests/0007_normalized_phone_constraint.sql`.
- Updated continuity docs.

**Changes Made**

- Added deterministic normalization for Mexican local, `+52`, legacy `+521`, `00` international, and generic international inputs.
- Rejected empty, alphabetic, short, invalid-country, and non-E.164 values.
- Added database validation requiring `normalized_phone` to match `+<country><digits>` with 8-15 digits.

**Migrations Added**

- `supabase/migrations/0007_normalized_phone_constraint.sql`.

**Tests Added Or Modified**

- Added 11 phone normalization unit cases.
- Added PostgreSQL constraint assertions.

**Commands Executed**

- `npm run db:verify-rls`: passed through migration `0007`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 70 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- None after the database constraint was added.

**Solution Applied**

- Not applicable.

**Commit Generated**

- `9a2a2aa feat: add customer phone normalization`

## 2026-07-24 00:28 MST - Phase 2 - Customer And Card Schema

**Objective:** Create tenant-scoped customers and one secure digital card per customer.

**Files Created Or Modified**

- Created `supabase/migrations/0006_customers_and_cards.sql`.
- Created `supabase/tests/0006_customers_and_cards.sql`.
- Modified `scripts/verify-rls.mjs` and migration tests.
- Updated continuity docs.

**Changes Made**

- Added customer status and registration method enums.
- Added `customers` with per-tenant normalized-phone uniqueness, source branch, privacy consent, registration method, and creator fields.
- Added `customer_cards` with one-card-per-customer constraint, random URL-safe token, token version, revocation status, and timestamps.
- Added tenant consistency triggers for customer source branch/creator and card ownership.
- Added RLS for Superadmin, Admin, and staff source-branch reads; anonymous direct access is revoked.
- Updated the PostgreSQL runner to wait for the configured database, not only server readiness.

**Migrations Added**

- `supabase/migrations/0006_customers_and_cards.sql`.

**Tests Added Or Modified**

- Added customer/card RLS, token safety, cross-tenant denial, and anonymous-access assertions.
- Extended migration tests.

**Commands Executed**

- `npm run db:verify-rls`: passed through migration `0006`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 59 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- PostgreSQL initialization could report readiness before the configured database existed.

**Solution Applied**

- Added an explicit `select 1` database readiness check.

**Commit Generated**

- `a381066 feat: add customer and card schema`

## 2026-07-24 00:13 MST - Phase 1 - Minimum Branch Management

**Objective:** Let active tenant Administrators list and create branches without accepting tenant authority from the browser.

**Files Created Or Modified**

- Created `src/app/admin/branches/actions.ts` and `page.tsx`.
- Created `src/lib/admin/branches.ts` and `branches.test.ts`.
- Modified the Admin page, global styles, and continuity docs.

**Changes Made**

- Added Admin-only branch listing and creation under `/admin/branches`.
- Derived every insert's `tenant_id` from the authenticated server context.
- Rejected Manager branch mutations even though Managers may access the Admin area.
- Validated required name, paired optional coordinates, coordinate ranges, integer geofence radius, address, and proximity setting.
- Added explicit branch-query error handling.

**Migrations Added**

- None.

**Tests Added Or Modified**

- Added four branch validation and tenant-authority boundary tests.
- Existing PostgreSQL RLS suite continues to cover cross-tenant branch insert denial.

**Commands Executed**

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 51 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- None.

**Solution Applied**

- Not applicable.

**Commit Generated**

- `8b0b4e9 feat: add admin branch management`

## 2026-07-24 00:17 MST - Phase 1 - Tenant Staff Provisioning

**Objective:** Allow an Admin to create Manager and Employee accounts inside the authenticated tenant.

**Files Created Or Modified**

- Created `src/lib/admin/staff.ts`.
- Created `src/lib/admin/staff.test.ts`.
- Created `src/app/admin/staff/actions.ts`.
- Created `src/app/admin/staff/page.tsx`.
- Modified `src/app/admin/page.tsx`.
- Updated continuity documentation.

**Changes Made**

- Added Admin-only `/admin/staff` listing and creation form.
- Limited selectable roles to `MANAGER` and `EMPLOYEE`.
- Added validation for name, normalized email, temporary password, and confirmation.
- Derived `tenant_id` and `created_by` from `requireInternalArea("ADMIN")`; no tenant id is accepted from the form.
- Created Auth users only through the server-only admin client.
- Inserted tenant staff profiles through the authenticated Admin's RLS context with `PASSWORD_RESET_REQUIRED`.
- Deleted the newly created Auth user when profile creation fails and surfaced an explicit cleanup error if deletion also fails.

**Migrations Added**

- None. Existing Phase 1 staff policies support the tenant-scoped insert.

**Tests Added Or Modified**

- Added five staff validation and server-boundary tests.

**Commands Executed**

- `npm run db:verify-rls`: passed through migration `0004`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 56 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- None.

**Solution Applied**

- Not applicable.

**Commit Generated**

- `123b713 feat: add admin staff provisioning`

## 2026-07-24 00:24 MST - Phase 1 - Staff Branch Assignments

**Objective:** Let tenant Administrators assign Manager and Employee profiles to active branches while preserving a single primary branch.

**Files Created Or Modified**

- Created `supabase/migrations/0005_staff_branch_assignments.sql`.
- Created `supabase/tests/0005_staff_branch_assignments.sql`.
- Created `src/app/admin/staff/assignments.ts`.
- Created `src/lib/admin/assignments.test.ts`.
- Modified `src/app/admin/staff/page.tsx`, `src/app/globals.css`, and migration tests.
- Updated continuity docs.

**Changes Made**

- Added a security-definer RPC callable only by authenticated sessions.
- Derived the acting tenant and Admin role from `auth.uid()`.
- Rejected cross-tenant staff, non-assignable roles, inactive branches, and non-Admin callers.
- Added a per-staff advisory transaction lock.
- Promoted the selected branch atomically and removed the previous primary flag.
- Added Admin UI to view assignments and assign active branches.

**Migrations Added**

- `supabase/migrations/0005_staff_branch_assignments.sql`.

**Tests Added Or Modified**

- Added positive and negative PostgreSQL assignment assertions.
- Added static RPC/server-boundary tests.

**Commands Executed**

- `npm run db:verify-rls`: passed through migration `0005`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 59 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- The first SQL assertion used unsupported `min(uuid)` aggregation.

**Solution Applied**

- Replaced it with a direct primary-assignment lookup; the RPC itself passed unchanged.

**Commit Generated**

- `01d2c8d feat: add staff branch assignments`

## 2026-07-23 23:45 MST - Phase 1 - Repeatable RLS Verification

**Objective:** Replace manual Phase 1 RLS checks with a deterministic local command.

**Files Created Or Modified**

- Created `scripts/verify-rls.mjs`.
- Created `supabase/tests/auth_bootstrap.sql`.
- Created `supabase/tests/0001_initial_auth_tenancy_rls.sql`.
- Modified `package.json`.
- Modified `src/lib/supabase/migrations.test.ts`.
- Modified `README.md`.
- Updated continuity docs.

**Changes Made**

- Added `npm run db:verify-rls`.
- Added a disposable PostgreSQL 16 test runner with guaranteed container cleanup.
- Added a minimal local Supabase Auth schema and `auth.uid()` substitute.
- Seeded active and suspended tenants plus Superadmin, Admin, Manager, Employee, inactive, and password-reset-required profiles.
- Added positive and negative assertions for tenant reads, branch assignments, cross-tenant updates/inserts, cross-tenant staff assignments, status restrictions, and Superadmin access.
- Audited the Phase 1 backlog and recorded omitted first-Administrator, password lifecycle, route guard, and staff-management tasks.

**Migrations Added**

- None. The harness applies the existing immutable `0001_initial_auth_tenancy.sql`.

**Tests Added Or Modified**

- Added the PostgreSQL integration suite in `supabase/tests/0001_initial_auth_tenancy_rls.sql`.
- Extended `src/lib/supabase/migrations.test.ts` to require all Phase 1 RLS scenarios.

**Commands Executed**

- `npm run db:verify-rls`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 20 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- None.

**Solution Applied**

- Not applicable.

**Commit Generated**

- `e6d95f7 test: add repeatable tenancy rls verification`

## 2026-07-23 23:53 MST - Phase 1 - First Tenant Administrator

**Objective:** Let an active Superadmin create the first tenant Administrator with a temporary password and mandatory-change state.

**Files Created Or Modified**

- Created `src/lib/auth/server.ts`.
- Created `src/lib/superadmin/administrators.ts`.
- Created `src/lib/superadmin/administrators.test.ts`.
- Created `src/app/superadmin/tenants/[tenantId]/administrator/new/actions.ts`.
- Created `src/app/superadmin/tenants/[tenantId]/administrator/new/page.tsx`.
- Created `supabase/migrations/0002_first_tenant_administrator.sql`.
- Created `supabase/tests/0002_first_tenant_administrator.sql`.
- Modified tenant creation redirect, admin boundary tests, migration tests, RLS runner, Auth bootstrap, global styles, README, and continuity docs.

**Changes Made**

- Redirected successful tenant creation directly to first-Administrator setup.
- Added server-side validation for name, normalized email, and 12-72 character temporary password confirmation.
- Added server-only Supabase Auth provisioning with confirmed email and no browser exposure of credentials.
- Added a service-role-only PostgreSQL RPC that verifies the creating Superadmin, locks per tenant, rejects a concurrent second first Administrator, and inserts `PASSWORD_RESET_REQUIRED`.
- Added Auth user deletion compensation when profile creation fails.
- Made existing-Administrator checks fail closed on database errors.
- Updated the database verifier to apply every versioned migration and SQL integration test in order.

**Migrations Added**

- `supabase/migrations/0002_first_tenant_administrator.sql`.

**Tests Added Or Modified**

- Added seven validation/provisioning tests in `src/lib/superadmin/administrators.test.ts`.
- Added PostgreSQL integration coverage for successful creation, email normalization, duplicate rejection, and unauthorized actor rejection.
- Extended server-only boundary and migration static tests.

**Commands Executed**

- `npm run db:verify-rls`: passed with migrations `0001` and `0002`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 29 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- Initial application-only duplicate check was vulnerable to concurrent requests.

**Solution Applied**

- Added an advisory-lock-protected PostgreSQL RPC as the atomic authority and retained Auth cleanup compensation.

**Commit Generated**

- `63fb8e0 feat: add first tenant administrator provisioning`

## 2026-07-23 23:58 MST - Phase 1 - Administrator Password Reset

**Objective:** Let Superadmin issue a new temporary password without allowing partial failures or inactive-user reactivation.

**Files Created Or Modified**

- Created `supabase/migrations/0003_tenant_administrator_password_reset.sql`.
- Created `supabase/tests/0003_tenant_administrator_password_reset.sql`.
- Modified the tenant Administrator action, page, validation/orchestration helpers, tests, styles, and continuity docs.

**Changes Made**

- Added a server-only reset form for the existing tenant Administrator.
- Added shared 12-72 character temporary-password validation.
- Added a service-role-only RPC that verifies an active Superadmin, locks the exact tenant Administrator row, rejects cross-tenant targets, and marks the profile `PASSWORD_RESET_REQUIRED`.
- Ordered reset operations so the profile is blocked before the Auth password changes.
- Left the profile blocked if the Auth update fails and return a retryable operational error.
- Prevented resets from changing an `INACTIVE` Administrator's status.

**Migrations Added**

- `supabase/migrations/0003_tenant_administrator_password_reset.sql`.

**Tests Added Or Modified**

- Added validation and orchestration tests proving profile-first ordering and partial-failure behavior.
- Added PostgreSQL integration checks for valid reset, cross-tenant denial, non-Superadmin denial, and inactive-status preservation.
- Extended server-only boundary and migration static tests.

**Commands Executed**

- `npm run db:verify-rls`: passed with migrations `0001` through `0003`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 36 tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

**Problems Encountered**

- Refactoring shared password validation initially changed error ordering.
- Resetting an inactive Administrator would have overwritten the inactive state.

**Solution Applied**

- Preserved the previous validation order.
- Restricted the reset RPC to `ACTIVE` and `PASSWORD_RESET_REQUIRED` Administrators and added a regression test.

**Commit Generated**

- `c423fc8 feat: add administrator temporary password reset`

## 2026-07-24 00:09 MST - Phase 1 - Mandatory Password Change And Route Guards

**Objective:** Complete the temporary-password lifecycle and enforce internal-route authorization from current database state.

**Files Created Or Modified**

- Created `src/app/change-password/actions.ts` and `page.tsx`.
- Created dynamic layouts for `/superadmin`, `/admin`, and `/app`.
- Created `src/lib/auth/passwords.ts`, `routes.ts`, and focused tests.
- Created `src/lib/auth/server-boundaries.test.ts`.
- Created `supabase/migrations/0004_complete_required_password_change.sql`.
- Created `supabase/tests/0004_complete_required_password_change.sql`.
- Modified login, middleware, server auth context, migration tests, and continuity docs.

**Changes Made**

- Redirected `PASSWORD_RESET_REQUIRED` staff from login and protected areas to `/change-password`.
- Required current-password verification, a distinct 12-72 character new password, and matching confirmation.
- Updated Supabase Auth before activating the staff profile.
- Restricted profile completion to a service-role-only RPC so browser clients cannot bypass the password change.
- Rejected completion for active profiles and suspended tenants.
- Added dynamic server layouts enforcing Superadmin, Admin/Manager, and Manager/Employee area permissions.
- Signed out unavailable profiles after login and denied inactive or suspended contexts.

**Migrations Added**

- `supabase/migrations/0004_complete_required_password_change.sql`.

**Tests Added Or Modified**

- Added password validation, role-route mapping, server-boundary, and migration tests.
- Added PostgreSQL checks for successful completion, direct authenticated-RPC denial, duplicate completion denial, and suspended-tenant denial.

**Commands Executed**

- Baseline `npm run typecheck`: passed.
- Baseline `npm run test:run`: passed; 36 tests passed.
- `npm run db:verify-rls`: passed with migrations `0001` through `0004`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 47 tests passed.
- `npm run build`: initially failed because protected layouts were prerendered without Supabase config; passed after marking them force-dynamic.
- `git diff --check`: passed.

**Problems Encountered**

- The first RPC design granted authenticated users enough permission to bypass the UI and activate a profile directly.
- Next.js initially attempted to prerender protected routes during build.

**Solution Applied**

- Restricted completion to `service_role` and added a direct-call denial regression test.
- Marked all protected route layouts and the change-password page as force-dynamic.

**Commit Generated**

- `151f289 feat: enforce password change and route access`
- `1327c47 docs: record scaffold status`

**Push**

- `git push -u origin codex/swiftwallet-mvp`: initially failed in sandbox with DNS resolution error for `github.com`; passed after network escalation and pushed through `1327c47`.
- Follow-up documentation commits were pushed to the same tracking branch; verify the exact latest hash with `git log --oneline -1`.

## 2026-07-23 23:10 MST - Phase 1 - Initial Tenancy/Auth Migration

**Objective:** Create and validate the first Supabase migration for tenant, branch, staff profile, branch assignment, role/status primitives, helper functions, triggers, grants, and RLS policies.

**Files Created Or Modified**

- Created `supabase/migrations/0001_initial_auth_tenancy.sql`.
- Created `src/lib/supabase/migrations.test.ts`.
- Updated `docs/IMPLEMENTATION_PLAN.md`.
- Updated `docs/PROJECT_STATUS.md`.
- Updated `docs/WORK_LOG.md`.
- Updated `docs/NEXT_SESSION.md`.
- Updated `docs/TRACEABILITY.md`.

**Changes Made**

- Added enums for tenant status, branding mode, branch status, staff role, and staff status.
- Added `tenants`, `branches`, `staff_profiles`, and `staff_branch_assignments`.
- Added timestamp trigger helper and assignment tenant-consistency trigger.
- Added `app.*` security-definer helpers for current staff tenant, role, active status, tenant access, tenant management, and branch access.
- Enabled and forced RLS on all Phase 1 tables.
- Added policies for Superadmin global access, tenant staff own-tenant access, admin own-tenant management, and assigned-branch access.
- Added explicit grants for `authenticated` while keeping `anon` out of app helper functions.
- Added Vitest static checks for migration structure, RLS enablement, helper functions, and negative isolation primitives.

**Migrations Added**

- `supabase/migrations/0001_initial_auth_tenancy.sql`.

**Tests Added Or Modified**

- Added `src/lib/supabase/migrations.test.ts`.

**Commands Executed**

- `npm run test:run`: passed; 5 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `docker run --name swiftwallet-migration-check -e POSTGRES_PASSWORD=postgres -d postgres:16-alpine`: passed.
- `docker exec swiftwallet-migration-check psql ... -f /tmp/0001_initial_auth_tenancy.sql`: passed.
- PostgreSQL RLS checks with `SET ROLE authenticated` and `request.jwt.claim.sub`: passed for admin tenant isolation, admin own-branch visibility, employee assigned-branch visibility, suspended tenant denial, and superadmin global tenant visibility.
- PostgreSQL negative checks: passed for admin cross-tenant branch insert denial and cross-tenant staff/branch assignment trigger denial.
- `docker rm -f swiftwallet-migration-check`: passed.

**Problems Encountered**

- Supabase CLI is not installed locally.
- PostgreSQL local socket was not active.
- Docker required escalation to access the daemon.
- First PostgreSQL validation found that standard PostgreSQL does not support `encode(..., 'base64url')`.
- A seed command initially omitted `tenant_id` values for branches; it rolled back cleanly.

**Solution Applied**

- Used local `postgres:16-alpine` Docker image with a minimal Supabase Auth prelude.
- Replaced `encode(..., 'base64url')` with base64 transformed to URL-safe text.
- Re-ran migration and RLS behavior checks from a clean temporary database.

**Commit Generated**

- `b2a9742 feat: add initial tenancy rls migration`
- `afc243c docs: record tenancy migration status`

**Push**

- `git push`: passed; pushed migration and continuity commits to `origin/codex/swiftwallet-mvp`.

## 2026-07-23 23:16 MST - Phase 1 - Application Permission Helpers

**Objective:** Add typed role and permission helpers for Phase 1 UI and route decisions while keeping backend/RLS as the source of enforcement.

**Files Created Or Modified**

- Created `src/lib/auth/permissions.ts`.
- Created `src/lib/auth/permissions.test.ts`.
- Updated `docs/IMPLEMENTATION_PLAN.md`.
- Updated `docs/PROJECT_STATUS.md`.
- Updated `docs/WORK_LOG.md`.
- Updated `docs/NEXT_SESSION.md`.
- Updated `docs/TRACEABILITY.md`.

**Changes Made**

- Added typed staff roles, staff statuses, tenant statuses, and staff access context.
- Added helpers for Superadmin panel, tenant creation, admin panel, branch/staff management, employee PWA access, branch access, branch operation, password reset state, and audit visibility.
- Added tests for Superadmin-only operations, Admin management permissions, Manager/Employee assigned-branch PWA access, suspended tenant denial, inactive staff denial, password-reset-required denial of operations, and audit visibility.

**Migrations Added**

- None.

**Tests Added Or Modified**

- Added `src/lib/auth/permissions.test.ts`.

**Commands Executed**

- `npm run test:run`: passed; 11 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

**Problems Encountered**

- None.

**Solution Applied**

- Not applicable.

**Commit Generated**

- `b6e62a0 feat: add role permission helpers`

## 2026-07-23 23:29 MST - Phase 1 - Login And Protected Route Foundation

**Objective:** Add Supabase SSR auth clients, login form/action, and middleware protection for internal routes.

**Files Created Or Modified**

- Modified `package.json` and `package-lock.json`.
- Modified `src/lib/supabase/config.ts`.
- Created `src/lib/supabase/browser.ts`.
- Created `src/lib/supabase/server.ts`.
- Created `src/lib/supabase/middleware.ts`.
- Created `src/lib/auth/redirects.ts`.
- Created `src/lib/auth/redirects.test.ts`.
- Created `src/app/login/actions.ts`.
- Created `src/app/login/page.tsx`.
- Created `middleware.ts`.
- Modified `src/app/globals.css`.
- Updated continuity docs.

**Changes Made**

- Installed `@supabase/ssr`.
- Added browser and server Supabase client factories using the public URL and anon key only.
- Added middleware session refresh using `getAll`/`setAll` cookies.
- Protected `/superadmin`, `/admin`, and `/app` paths behind Supabase user authentication.
- Added `/login` with a server action for email/password sign-in.
- Added safe redirect handling to avoid open redirects.
- Added login form styling.

**Migrations Added**

- None.

**Tests Added Or Modified**

- Added `src/lib/auth/redirects.test.ts`.

**Commands Executed**

- `npm install @supabase/ssr@latest`: initially failed in sandbox with DNS `ENOTFOUND`; passed after network escalation.
- `npm run test:run`: passed; 14 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

**Problems Encountered**

- Sandbox DNS blocked the first npm install attempt.

**Solution Applied**

- Re-ran npm install with network escalation.

**Commit Generated**

- `22495ff feat: add supabase login foundation`

## 2026-07-23 23:36 MST - Phase 1 - Minimal Superadmin Tenant Creation

**Objective:** Add a minimal Superadmin path for creating tenants with server-side validation and a server-only service role boundary.

**Files Created Or Modified**

- Modified `package.json` and `package-lock.json`.
- Created `src/lib/supabase/admin.ts`.
- Created `src/lib/supabase/admin.test.ts`.
- Created `src/lib/superadmin/tenants.ts`.
- Created `src/lib/superadmin/tenants.test.ts`.
- Created `src/app/superadmin/tenants/new/actions.ts`.
- Created `src/app/superadmin/tenants/new/page.tsx`.
- Modified `src/app/superadmin/page.tsx`.
- Modified `src/app/globals.css`.
- Updated continuity docs.

**Changes Made**

- Installed `server-only`.
- Added a server-only Supabase admin client factory that reads `SUPABASE_SERVICE_ROLE_KEY` only on the server and disables session persistence.
- Added tenant create form validation for name, currency, timezone, contact email, branding mode, status, and colors.
- Added Superadmin-only server action that verifies the current authenticated profile before using the admin client.
- Added `/superadmin/tenants/new` form and a success state on `/superadmin`.

**Migrations Added**

- None.

**Tests Added Or Modified**

- Added `src/lib/supabase/admin.test.ts`.
- Added `src/lib/superadmin/tenants.test.ts`.

**Commands Executed**

- `npm install server-only@latest`: passed.
- `npm run test:run`: initially failed because missing currency produced a duplicate validation error; passed after correction with 19 tests.
- `npm run lint`: passed.
- `npm run typecheck`: initially failed because TypeScript did not narrow normalized enum strings; passed after correction.
- `npm run build`: passed.

**Problems Encountered**

- Tenant validation emitted an extra currency length error when currency was missing.
- TypeScript needed an explicit cast for normalized enum values.

**Solution Applied**

- Only run currency length validation when the currency field has a value.
- Cast validated enum values to `T[number]` after `allowed.includes`.

**Commit Generated**

- `e6e71f5 feat: add superadmin tenant creation`
- `f9cf256 docs: record superadmin tenant status`

**Push**

- `git push`: passed; pushed Superadmin tenant creation and continuity commits to `origin/codex/swiftwallet-mvp`.

## 2026-07-23 22:20 MST - Phase 0 - Application Scaffold

**Objective:** Initialize the SwiftWallet application foundation and validate the base toolchain.

**Files Created Or Modified**

- Created `package.json` and `package-lock.json`.
- Created `.gitignore` and `.env.example`.
- Created `next.config.mjs`, `tsconfig.json`, `next-env.d.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs`, and `vitest.config.ts`.
- Created `src/app/**` base App Router routes.
- Created `src/app/api/health/route.ts` and `src/app/api/health/route.test.ts`.
- Created `src/lib/supabase/config.ts` and `src/lib/utils.ts`.
- Updated `README.md`.
- Updated continuity docs.

**Changes Made**

- Added Next.js 16 App Router scaffold.
- Added Tailwind CSS base styling and route placeholders.
- Added public and server Supabase config helper boundaries without exposing service role in browser code.
- Added health check endpoint and Vitest test.
- Configured `npm run build` to use webpack because Turbopack cannot bind a helper process port inside the current sandbox.

**Migrations Added**

- None.

**Tests Added Or Modified**

- Added `src/app/api/health/route.test.ts`.

**Commands Executed**

- `npm install`: initially failed in the sandbox with DNS `ENOTFOUND`; passed after network escalation.
- `npm install`: passed after pinning compatible versions.
- `npm prune`: passed.
- `npm ls --depth=0`: passed.
- `npm run lint`: failed with `FlatCompat` circular config error, then passed after switching to Next flat config exports.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 1 test passed.
- `npm run build`: failed with Turbopack sandbox port binding error, then passed with `next build --webpack`.
- `npm audit --omit=dev`: completed with 3 high runtime advisories in Next.js transitive dependencies; `npm audit fix --force` proposes a breaking downgrade and was not applied.

**Problems Encountered**

- Network is restricted in sandbox and required escalation for npm installs/metadata.
- Latest ESLint 10 required Node `22.13+`; local runtime is Node `22.12.0`.
- Next 16 Turbopack build failed in sandbox while processing CSS because it attempted to bind a port.
- npm audit reports current transitive vulnerabilities in Next.js dependencies.

**Solution Applied**

- Pinned ESLint to 9.36.0 and TypeScript to 5.9.3 while keeping Next.js 16.2.11.
- Switched ESLint config to native Next flat config exports.
- Set `next.config.mjs` `turbopack.root` and changed build script to `next build --webpack`.
- Documented npm audit risk instead of applying an unsafe forced downgrade.

**Commit Generated**

- `3eb962b chore: initialize swiftwallet scaffold`
