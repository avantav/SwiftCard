# SwiftWallet Implementation Plan

This backlog translates `docs/PRODUCT.md` into executable phases. A task is only `Terminada` when code, tests, validations, and continuity docs reflect the state.

## Phase 0 - Preparación

**Objective:** Create the application foundation: Next.js, TypeScript, Tailwind, Supabase client structure, quality scripts, tests, health check, and local documentation.

**Dependencies:** `docs/PRODUCT.md` available.

**Tasks**

- [x] [Terminada] Create `docs/PRODUCT.md` from the provided master document.
- [x] [Terminada] Create persistent project operating rules in `AGENTS.md`.
- [x] [Terminada] Create continuity documents under `docs/`.
- [x] [Terminada] Initialize Next.js App Router, TypeScript, Tailwind, lint, typecheck, tests, and build scripts.
- [x] [Terminada] Add base app routes for `/`, `/superadmin`, `/admin`, `/app`, `/register/[branchToken]`, `/card/[cardToken]`, and `/api/health`.
- [x] [Terminada] Add Supabase environment template and server-only/public config placeholders without secrets.
- [x] [Terminada] Add base unit test setup and a health check test.
- [x] [Terminada] Run `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.

**Acceptance Criteria**

- The app builds locally.
- Quality scripts exist and run.
- No secrets are committed.
- Health endpoint returns a deterministic OK response.
- Documentation states the real validation result.

**Related Files**

- `package.json`
- `next.config.*`
- `tsconfig.json`
- `src/app/**`
- `src/lib/**`
- `docs/**`

**Validation Result:** Completed on 2026-07-23. Runtime `npm audit --omit=dev` reports current Next.js transitive vulnerabilities in `postcss` and `sharp`; `npm audit fix --force` proposes an unsafe downgrade to Next 9, so the risk is documented instead of applying the fix.

## Phase 1 - Multi-Tenant And Authentication

**Objective:** Implement tenants, branches, staff profiles, roles, assignments, RLS, login, temporary password handling, and minimum Superadmin flow.

**Dependencies:** Phase 0 complete.

**Tasks**

- [x] [Terminada] Create initial Supabase migration for tenant, branch, staff, and assignment schema.
- [x] [Terminada] Enable RLS and add tenant/branch isolation policies.
- [x] [Terminada] Add application role and permission helpers.
- [x] [Terminada] Implement login and protected route structure.
- [x] [Terminada] Implement minimal Superadmin tenant creation flow.
- [x] [Terminada] Add positive and negative RLS tests.
- [x] [Terminada] Implement first Administrator creation from Superadmin.
- [x] [Terminada] Implement temporary-password reset from Superadmin.
- [x] [Terminada] Enforce role/status route guards and mandatory password change.
- [x] [Terminada] Implement minimum branch management.
- [x] [Terminada] Implement tenant staff account provisioning.
- [x] [Terminada] Implement staff branch assignments and primary branch management.

**Acceptance Criteria**

- Tenant A users cannot read or modify Tenant B data.
- Staff access is limited to assigned branches.
- Inactive users and suspended tenants cannot operate.
- Service role is never exposed to browser code.
- Superadmin can create the first Administrator with a temporary password.
- Temporary passwords require a password change before operational access.

**Validation Result:** Through migration `0005`, `npm run db:verify-rls` applies the Phase 1 database to disposable PostgreSQL 16 and passes tenant/branch isolation, status denial, Superadmin boundaries, first-Administrator provisioning, password reset, mandatory-change completion, and staff branch assignment checks.

## Phase 2 - Clientes And Web Card

**Objective:** Implement customer registration, phone normalization, duplicate handling, search, secure card tokens, editing, deactivation, and web card.

**Dependencies:** Phase 1 complete.

**Tasks**

- [x] [Terminada] Add customer and card schema.
- [x] [Terminada] Implement phone normalization with tests.
- [x] [Terminada] Implement self-service registration by branch token.
- [x] [Terminada] Implement employee registration.
- [x] [Terminada] Implement customer search and profile editing.
- [x] [Terminada] Implement public web card by card token.

## Phase 3 - Motor De Fidelidad

**Objective:** Implement purchase and amount rules, remainder handling, ledger, rewards, expiration, program pause, and rule changes.

**Dependencies:** Phase 2 complete.

**Tasks**

- [x] [Terminada] Add loyalty program, balance, ledger, purchase, and reward schema.
- [x] [Terminada] Implement purchase preview and confirm backend logic.
- [x] [Terminada] Implement multiple reward generation.
- [x] [Terminada] Implement program pause behavior.
- [x] [Terminada] Add unit and integration tests for rules, remainders, ledger, and rewards.

## Phase 4 - PWA

**Objective:** Build installable employee PWA with scan/search/register/purchase/redeem flows, online-only state, camera and location handling.

**Dependencies:** Phase 3 complete.

**Tasks**

- [x] [Terminada] Add manifest and install metadata.
- [x] [Terminada] Implement scanner route and QR parsing.
- [x] [Terminada] Implement purchase and redemption mobile flows.
- [x] [Terminada] Add strict/flexible geolocation handling.
- [x] [Terminada] Add double-submit protection.

## Phase 5 - Operaciones Administrativas

**Objective:** Implement purchase cancellation, redemption reversal, manual stamp adjustments, reward cancellation, audit logs, and histories.

**Dependencies:** Phase 4 complete.

**Tasks**

- [x] [Terminada] Implement immutable audit log schema and write paths.
- [x] [Terminada] Implement purchase cancellation with consistency checks.
- [x] [Terminada] Implement redemption reversal.
- [x] [Terminada] Implement stamp adjustments with mandatory reason.
- [x] [Terminada] Implement reward cancellation rules.

## Phase 6 - Dashboard And Exportaciones

**Objective:** Implement KPIs, filters, trends, rankings, and CSV/XLSX exports respecting permissions.

**Dependencies:** Phase 5 complete.

**Tasks**

- [x] [Terminada] Implement metrics queries and permission filters.
- [x] [Terminada] Implement dashboard views.
- [x] [Terminada] Implement CSV exports.
- [x] [Terminada] Implement XLSX exports with the same permission scope, filters, and allowlisted data as CSV.

## Phase 7 - Superadmin And Importaciones

**Objective:** Implement CSV/XLSX imports, mapping, validation, history, tenant metrics, suspension, and branding mode.

**Dependencies:** Phase 6 complete.

**Tasks**

- [x] [Terminada] Implement import schema and Superadmin upload flow.
- [x] [Terminada] Implement column mapping and validation preview without customer mutation.
- [x] [Terminada] Implement atomic import confirmation with duplicate/error summary.
- [x] [Terminada] Implement tenant suspension and reactivation controls.
- [x] [Terminada] Implement branding mode controls.

## Phase 8 - Wallet

**Objective:** Integrate Apple Wallet and Google Wallet pass generation, updates, branch locations, compatible notifications, and device validation.

**Dependencies:** Phase 7 complete and external credentials available.

**Tasks**

- [x] [Terminada] Add wallet pass schema and server-only service boundaries.
- [x] [Terminada] Implement Web Card fallback updates through the dynamic public projection.
- [ ] [Pendiente] Implement Apple Wallet generation behind server-only config.
- [ ] [Pendiente] Implement Google Wallet generation behind server-only config.
- [x] [Terminada] Document required external credentials without storing secrets.

## Phase 9 - Piloto

**Objective:** Complete E2E, security, RLS, monitoring, backups, privacy, pilot tenant, and production checklist.

**Dependencies:** Phase 8 complete and pilot information available.

**Tasks**

- [ ] [Pendiente] Add E2E happy path.
- [x] [Terminada] Add security/RLS regression suite.
- [x] [Terminada] Add production checklist.
- [x] [Terminada] Document monitoring and backup plan.
- [ ] [Pendiente] Validate pilot tenant readiness.
