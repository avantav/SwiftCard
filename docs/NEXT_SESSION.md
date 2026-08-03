# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit before this PWA task: `91d212f feat: apply enterprise design across app`.
3. Git status: working tree expected clean after the PWA installability commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: return to authorized correction and operational-history UI after completing the employee PWA installation layer.
5. Last completed task: added adaptive launcher icons, complete standalone/Apple metadata, secure worker registration, a static offline fallback, connection state, offline submit blocking, and Android/iOS installation guidance.
6. Completed behavior: the employee app can be added to phone/tablet home screens; launcher shortcuts open operational routes; the UI reports connectivity; operational forms stop while offline; and only the non-sensitive offline notice enters Cache Storage.
7. Relevant files: `src/app/manifest.ts`, `src/app/layout.tsx`, `src/app/app/layout.tsx`, `src/components/pwa-controller.tsx`, `src/app/globals.css`, `public/sw.js`, `public/offline.html`, `public/icons/**`, `next.config.mjs`, and `src/lib/pwa/**`.
8. Commands passed: `npm run lint`, `npm run typecheck`, all 131 Vitest tests, `npm run build`, live manifest/worker/offline response checks, and exact-style PWA review at 375/768 px; temporary review routes were removed.
9. Immediate step: implement the authorized correction actions in the Admin/Manager UI while reusing the mandatory shell, hierarchy, state, responsive, and accessibility rules.
10. First incomplete feature task: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by permission-scoped operational and audit history views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0033`.
