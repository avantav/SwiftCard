# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `b2a9742 feat: add initial tenancy rls migration`.
3. Git status: continuity docs updated with the latest migration commit hash.
4. Current phase: Phase 1 - Multi-Tenant And Authentication.
5. Last completed task: Created and validated the initial Supabase tenancy/auth migration with RLS policies.
6. Task in progress: Add application role and permission helpers for Phase 1 UI/backend routing decisions.
7. Relevant files: `supabase/migrations/0001_initial_auth_tenancy.sql`, `src/lib/supabase/migrations.test.ts`, `src/lib/supabase/config.ts`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TRACEABILITY.md`.
8. Commands already passed: `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, temporary PostgreSQL 16 migration validation via Docker, and RLS behavior checks.
9. Pending commands: repeat lint, typecheck, test, build after adding TypeScript permission helpers.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Create `src/lib/auth/permissions.ts` with typed staff roles and Phase 1 permission predicates, add `src/lib/auth/permissions.test.ts` for Superadmin/Admin/Manager/Employee cases, and ensure tests document that backend/RLS remains the enforcement layer.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; latest migration commit push is pending until this continuity update is committed.
