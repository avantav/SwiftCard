# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `9a7b331 feat: add public web card`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented the public Web Card projection by card token.
6. Task in progress: Add Phase 3 loyalty program, balance, ledger, purchase, and reward schema.
7. Relevant files: `src/app/card/[cardToken]/page.tsx`, `supabase/migrations/0011_public_web_card.sql`, `supabase/tests/0011_public_web_card.sql`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 77 tests, and `npm run build`.
9. Pending commands: loyalty schema implementation and purchase/reward invariant tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Define the Phase 3 loyalty tables and constraints for one active program per tenant, minor-unit monetary amounts, ledger entries, purchases, rewards, and atomic balance invariants; add migration tests before implementing purchase RPCs.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
