# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `7105b3b feat: add customer search and editing`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented customer search, editing, and deactivation.
6. Task in progress: Implement public web card by card token.
7. Relevant files: `src/app/app/customers/page.tsx`, `src/app/app/customers/actions.ts`, `supabase/migrations/0010_customer_profile_management.sql`, `supabase/tests/0010_customer_profile_management.sql`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 76 tests, and `npm run build`.
9. Pending commands: public card token route implementation and unknown/revoked token tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Implement `/card/[cardToken]` using a server-side public-card query or RPC, returning no data for unknown/revoked tokens and never exposing tenant internals, phone, UUID, or raw database rows.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
