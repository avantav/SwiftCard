# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `01d2c8d feat: add staff branch assignments`.
3. Git status: clean after the staff assignment continuity commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Closed Phase 1 staff branch assignments and primary branch management.
6. Task in progress: Add customer and card schema.
7. Relevant files: `docs/PRODUCT.md`, `supabase/migrations/0001_initial_auth_tenancy.sql`, `supabase/migrations/0005_staff_branch_assignments.sql`, `supabase/tests/0005_staff_branch_assignments.sql`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TRACEABILITY.md`.
8. Commands already passed: `npm run db:verify-rls` through migration `0005`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 59 tests, and `npm run build`.
9. Pending commands: Phase 2 customer/card migration and tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Create the Phase 2 customer and customer-card migration with `UNIQUE (tenant_id, normalized_phone)`, tenant-derived RLS, a random rotatable public token, and tests proving no token exposes customer data.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; Phase 1 assignment commits were pushed successfully.
