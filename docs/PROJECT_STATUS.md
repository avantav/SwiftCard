# Project Status

## Current State

- Current phase: Phase 1 - Multi-Tenant And Authentication.
- Current task: Add positive and negative RLS tests.
- Last completed task: Implemented minimal Superadmin tenant creation flow.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable commit: `e6e71f5 feat: add superadmin tenant creation`.
- Git status: clean after the continuity documentation commit.
- Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; latest push succeeded.

## Completed Functionality

- Product source normalized into `docs/PRODUCT.md`.
- Persistent repo instructions added in `AGENTS.md`.
- Executable implementation plan started.
- Next.js 16 App Router scaffold.
- Base routes: `/`, `/superadmin`, `/admin`, `/app`, `/register/[branchToken]`, `/card/[cardToken]`.
- Health endpoint: `/api/health`.
- Vitest health endpoint test.
- Supabase environment template and config helpers without secrets.
- Initial tenancy/auth migration for tenants, branches, staff profiles, staff branch assignments, helper functions, triggers, grants, and RLS policies.
- Static migration coverage in Vitest.
- TypeScript role/permission helpers for Phase 1 UI/routing decisions.
- Supabase SSR dependency and client factories.
- `/login` page with email/password server action.
- Middleware session refresh and protection for `/superadmin`, `/admin`, and `/app`.
- Open redirect protection for auth redirects.
- Server-only Supabase admin client guarded by `server-only`.
- Minimal `/superadmin/tenants/new` form and server action for tenant creation.
- Tenant creation input validation tests.

## Pending Functionality

- Remaining Phase 1 formal RLS test suite integration.
- All later MVP functional phases.

## Active Blockers

- None.

## Known Risks

- `npm audit --omit=dev` reports high-severity runtime advisories in Next.js transitive dependencies `postcss` and `sharp`; `npm audit fix --force` proposes a breaking downgrade to Next 9 and was not applied.
- `npm install` reports an `EBADENGINE` warning for transitive `eslint-visitor-keys@5.0.1`, which requires Node `22.13+`; local Node is `22.12.0`. `npm ls`, lint, typecheck, tests, and build still pass.
- Wallet integrations later require external Apple and Google credentials.

## Last Validation Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 1 test passed.
- `npm run build`: passed with webpack.
- `npm audit --omit=dev`: completed with 3 high runtime advisories; no safe automatic fix.
- Temporary PostgreSQL 16 migration validation via Docker: passed.
- RLS behavior checks via `SET ROLE authenticated` and `request.jwt.claim.sub`: passed.
- Role/permission helper unit tests: passed.
- Auth redirect helper tests: passed.
- Tenant validation and server-only admin boundary tests: passed.

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Add a repeatable RLS verification script or test harness for the tenancy migration so positive/negative isolation checks can run without manual SQL steps.
