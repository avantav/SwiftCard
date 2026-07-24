# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `8a0523c feat: add employee pwa manifest`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Added PWA manifest, viewport metadata, and install icon.
6. Task in progress: Implement scanner route and QR parsing.
7. Relevant files: `src/app/manifest.ts`, `src/app/layout.tsx`, `public/icon.svg`, `src/lib/pwa/manifest.test.ts`.
8. Commands already passed: `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 81 tests, and `npm run build`; build includes `/manifest.webmanifest`.
9. Pending commands: scanner route, QR parsing boundary, and backend token validation tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add `/app/scan` with a bounded QR token parser and backend lookup handoff; do not implement offline scanning or trust QR payloads as authorization.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
