# Work Log

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
