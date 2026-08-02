# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit before hosted setup: `73bdb9b feat: add admin loyalty program controls`.
3. Git status: working tree expected clean after the hosted-setup commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: return to authorized correction and operational-history UI after completing the Superadmin redesign.
5. Last completed task: rebuilt the Superadmin shell and workflows under `docs/DESIGN_SYSTEM.md` and reviewed the authenticated populated state at every required responsive width.
6. Completed behavior: repeatable remote migrations with canonical history, explicit `app` schema RPC routing, modern Supabase key-name support with legacy fallback, and a compensated one-time Superadmin bootstrap command.
7. Relevant files: `docs/DESIGN_SYSTEM.md`, `src/app/superadmin/layout.tsx`, `src/app/superadmin/page.tsx`, `src/components/superadmin-navigation.tsx`, `src/components/tenant-status-form.tsx`, `src/app/globals.css`, and `src/lib/superadmin/design.test.ts`.
8. Commands passed: `npm run lint` with one pre-existing Next image warning, `npm run typecheck`, `npm run test:run` with 122 tests, `npm run build`, and authenticated Chrome review at 375, 768, 1280, and 1440 px.
9. Immediate step: implement the authorized correction actions in the Admin/Manager UI while reusing the mandatory shell, hierarchy, state, responsive, and accessibility rules.
10. First incomplete feature task: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by permission-scoped operational and audit history views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0033`.
