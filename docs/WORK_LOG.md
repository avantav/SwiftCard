# Work Log

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
