# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit before hosted setup: `73bdb9b feat: add admin loyalty program controls`.
3. Git status: working tree expected clean after the hosted-setup commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: redesign the Superadmin experience under the mandatory enterprise design system before continuing feature development.
5. Last completed task: added `docs/DESIGN_SYSTEM.md`, made it required by `AGENTS.md`, and recorded the decision in `docs/DECISIONS.md`.
6. Completed behavior: repeatable remote migrations with canonical history, explicit `app` schema RPC routing, modern Supabase key-name support with legacy fallback, and a compensated one-time Superadmin bootstrap command.
7. Relevant files: `docs/DESIGN_SYSTEM.md`, `AGENTS.md`, `docs/DECISIONS.md`, `src/app/superadmin/page.tsx`, `src/app/superadmin/layout.tsx`, and `src/app/globals.css`.
8. Commands passed: `npm run lint` with one pre-existing Next image warning, `npm run typecheck`, `npm run test:run` with 118 tests, `npm run db:verify-rls` through migration `0033`, `npm run db:push:remote`, and live hosted Data API checks.
9. Immediate step: redesign `/superadmin` and its shared shell in strict compliance with `docs/DESIGN_SYSTEM.md`, including empty, populated, success, error, responsive, and accessible states.
10. First incomplete feature task after UI review: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by permission-scoped operational and audit history views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0033`.
