# Project Status

## Current State

- Current phase: Phase 1 - Multi-Tenant And Authentication.
- Current task: Create the initial Supabase migration for tenants, branches, staff profiles, and branch assignments.
- Last completed task: Completed Phase 0 scaffold with Next.js App Router, TypeScript, Tailwind, Supabase config placeholders, routes, health check, and validation scripts.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable commit: `3eb962b chore: initialize swiftwallet scaffold`.
- Git status: clean after the continuity documentation commit.

## Completed Functionality

- Product source normalized into `docs/PRODUCT.md`.
- Persistent repo instructions added in `AGENTS.md`.
- Executable implementation plan started.
- Next.js 16 App Router scaffold.
- Base routes: `/`, `/superadmin`, `/admin`, `/app`, `/register/[branchToken]`, `/card/[cardToken]`.
- Health endpoint: `/api/health`.
- Vitest health endpoint test.
- Supabase environment template and config helpers without secrets.

## Pending Functionality

- All MVP functional phases.
- Initial Supabase schema and RLS policies.

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

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Create `supabase/migrations/0001_initial_auth_tenancy.sql` for tenants, branches, staff profiles, staff branch assignments, enums, RLS enablement, and initial isolation policy scaffolding.
