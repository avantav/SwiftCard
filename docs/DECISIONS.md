# Decisions

## DEC-0001 - Continuity Documentation Is Repository-Owned

- Date: 2026-07-23
- Context: The project must be resumable without relying on chat history.
- Decision: Keep the product source, plan, status, work log, decisions, blockers, next-session recovery note, and traceability matrix inside `docs/`.
- Alternatives considered: Keeping status only in chat, or using a single status file.
- Reason: The repository must contain enough state for a new session to resume safely.
- Consequences: Every stable work unit must update documentation before commit.
- Status: Accepted.

## DEC-0002 - Use Webpack For Production Build In Local Scaffold

- Date: 2026-07-23
- Context: Next.js 16 uses Turbopack during `next build`, but Turbopack failed in the sandbox while processing CSS because it attempted to bind a helper process port.
- Decision: Use `next build --webpack` for the project build script and set `turbopack.root` to the repository root for future dev/build commands that use Turbopack.
- Alternatives considered: Downgrade Next.js, remove Tailwind/PostCSS, or request broad sandbox changes for every build.
- Reason: Webpack build passes in the current environment while preserving current Next.js and React versions.
- Consequences: Production build uses webpack until Turbopack can run reliably in the project environment.
- Status: Accepted.

## DEC-0003 - Public Tables With App Schema RLS Helpers

- Date: 2026-07-23
- Context: Supabase defaults expose `public` tables through PostgREST, while RLS policies need reusable session-derived tenant and branch checks without trusting frontend-provided `tenant_id`.
- Decision: Keep MVP data tables in `public` and place reusable authorization helpers in the `app` schema as `security definer` functions.
- Alternatives considered: Put all tables in a private schema, duplicate policy expressions inline, or defer RLS helper design until application routes exist.
- Reason: Public tables match Supabase conventions, while app-scoped helpers reduce RLS recursion risk and keep tenant/branch checks consistent.
- Consequences: Future migrations must grant helper execution intentionally and keep app helper functions free of frontend-controlled authority.
- Status: Accepted.
