# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `9a2a2aa feat: add customer phone normalization`.
3. Git status: clean after the phone normalization continuity commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented deterministic phone normalization and database format constraint.
6. Task in progress: Implement self-service registration by branch token.
7. Relevant files: `src/lib/customers/phone.ts`, `src/lib/customers/phone.test.ts`, `supabase/migrations/0007_normalized_phone_constraint.sql`, `supabase/tests/0007_normalized_phone_constraint.sql`.
8. Commands already passed: `npm run db:verify-rls` through migration `0007`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 70 tests, and `npm run build`.
9. Pending commands: self-service registration implementation and duplicate-phone behavior tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add the public branch-token registration route and secure RPC that normalizes submitted phones, handles duplicate phones generically, and creates customer/card records atomically for active branches.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
