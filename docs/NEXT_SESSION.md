# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `c86dddf feat: add reward cancellation`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented Administrator-only reward cancellation.
6. Task in progress: Implement metrics queries and permission filters.
7. Relevant files: `supabase/migrations/0021_reward_cancellation.sql`, `supabase/tests/0021_reward_cancellation.sql`, `src/lib/loyalty/reward-cancellation.test.ts`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 87 tests, and `npm run build`.
9. Pending commands: dashboard metrics RPCs and tenant/assigned-branch visibility tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add scoped dashboard metric RPCs for customer/purchase/reward counts and amounts, returning only tenant data for Admin and assigned-branch data for Manager.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
