# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `9a2a2aa feat: add customer phone normalization`.
3. Git status: clean after the phone normalization continuity commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented public self-service registration by active branch token.
6. Task in progress: Implement employee registration.
7. Relevant files: `src/lib/customers/phone.ts`, `src/lib/customers/phone.test.ts`, `supabase/migrations/0007_normalized_phone_constraint.sql`, `supabase/tests/0007_normalized_phone_constraint.sql`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 73 tests, and `npm run build`.
9. Pending commands: employee registration implementation and assigned-branch RLS tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add an authenticated employee registration action that derives tenant and source branch from the staff session and calls a backend RPC for customer/card creation; add positive and negative assigned-branch tests.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
