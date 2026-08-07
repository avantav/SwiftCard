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

## DEC-0004 - Compensated Auth Provisioning With Atomic Profile Creation

- Date: 2026-07-23
- Context: Creating a Supabase Auth user and the tenant staff profile crosses the Auth API and application data boundary, while concurrent first-Administrator requests must not create two initial Administrators.
- Decision: Create the Auth user server-side, create the profile through a service-role-only PostgreSQL function protected by a tenant-scoped advisory transaction lock, and delete the new Auth user if profile creation fails.
- Alternatives considered: Insert the profile directly from the server action, add a permanent one-Administrator unique constraint, or create staff profiles from a generic `auth.users` trigger.
- Reason: The RPC makes the first-profile decision atomic without forbidding future additional Administrators, and compensation prevents ordinary failures from leaving orphan Auth users.
- Consequences: A failed compensation is surfaced as an explicit operational error; the service role boundary and RPC grants require regression tests.
- Status: Accepted.

## DEC-0005 - Dynamic Route Guards And Server-Only Password Completion

- Date: 2026-07-24
- Context: Authentication middleware only proves a Supabase session exists; internal areas also require role, staff status, tenant status, and mandatory password-change enforcement.
- Decision: Guard each internal route tree in a force-dynamic server layout, redirect reset-required users to `/change-password`, and keep profile activation behind a service-role-only RPC invoked after the server updates Auth.
- Alternatives considered: Put role claims in cookies/JWT metadata, rely on client navigation guards, or grant the completion RPC directly to authenticated users.
- Reason: Server layouts always read current RLS-protected database state, while the service-role RPC prevents users from activating their profile without changing the Auth password.
- Consequences: Protected route trees are dynamically rendered and require Supabase configuration at request time; build-time prerendering is intentionally disabled for them.
- Status: Accepted.

## DEC-0006 - Reward Expiration Uses Enforcement Plus Lazy Sweeps

- Date: 2026-07-30
- Context: Reward expiration must be authoritative even when no external scheduler is configured for the MVP.
- Decision: Reject and transition an expired reward inside the redemption RPC, sweep due rewards when an authenticated staff reward list is opened, and independently exclude overdue rewards from the anonymous Web Card projection.
- Alternatives considered: Rely only on a scheduled job, leave overdue rows as AVAILABLE until redemption, or calculate a display-only effective status.
- Reason: The critical redemption boundary remains correct without infrastructure assumptions, while staff and public views stop presenting overdue rewards.
- Consequences: `EXPIRED` transitions are auditable; a future scheduled sweep may call the same tenant-scoped operation but is not required for redemption safety.
- Status: Accepted.

## DEC-0007 - Program Goal Changes Create A Ledger Boundary

- Date: 2026-07-30
- Context: Lowering a reward goal can convert existing balances into rewards, and a later purchase cancellation must not reconstruct a balance across that conversion.
- Decision: Serialize program changes with balance-mutating operations, convert qualifying balances atomically, and append a zero-delta `PROGRAM_CHANGE` ledger entry for every converted customer.
- Alternatives considered: Recalculate cancellations through historical program versions, generate rewards without a ledger marker, or block all goal changes while customers have balances.
- Reason: The ledger marker preserves an explicit consistency boundary and lets the existing later-activity cancellation guard reject unsafe reversals.
- Consequences: Purchases before a converting goal change cannot be cancelled through the simple rollback path; an operator must use an audited corrective adjustment when appropriate.
- Status: Accepted.

## DEC-0008 - Expose Permission-Scoped Application RPCs Explicitly

- Date: 2026-08-02
- Context: SwiftWallet stores authorization helpers and critical RPCs in the `app` schema, but hosted Supabase exposes `public` by default and unqualified Supabase client RPC calls resolve only against the default schema.
- Decision: Expose `app` alongside `public` and `graphql_public`, keep `public` as the default schema, and route every `app.*` RPC through `supabase.schema("app").rpc(...)`.
- Alternatives considered: Move critical functions into `public`, add public wrapper functions, or make `app` the default Data API schema.
- Reason: Explicit schema routing preserves the existing database boundary, avoids duplicating the API surface, and keeps ordinary table access in `public`.
- Consequences: Hosted environments must apply migration `0033`; all new `app` RPC call sites must select the schema explicitly, while function grants remain the authority boundary.
- Status: Accepted.

## DEC-0009 - Mandatory Enterprise Design System

- Date: 2026-08-02
- Context: Existing screens were implemented incrementally and do not yet share a sufficiently rigorous enterprise visual and interaction standard.
- Decision: Adopt `docs/DESIGN_SYSTEM.md` as the mandatory UI source of truth and require it in session startup, implementation review, and completion criteria through `AGENTS.md`.
- Alternatives considered: Keep visual guidance informal, redesign only the Superadmin page, or copy a third-party interface directly.
- Reason: A repository-owned system creates consistent navigation, hierarchy, density, accessibility, responsive behavior, and interaction states across future work without relying on chat history.
- Consequences: Every modified interface must move toward the shared system, applicable checklist items must be verified, and exceptions require explicit user authorization plus a recorded decision. Verkada remains conceptual inspiration only; SwiftWallet retains its own identity.
- Status: Accepted.

## DEC-0010 - PWA Remains Online-Only With A Static Offline Fallback

- Date: 2026-08-02
- Context: The employee PWA must be installable and communicate connection loss, while the MVP explicitly excludes offline operation and handles tenant, customer, purchase, and reward data.
- Decision: Register a root-scoped service worker that caches only a static, non-sensitive offline notice and uses the network for every application navigation and operation. Do not cache authenticated HTML, tenant data, API responses, Supabase traffic, or operational assets for offline use. Block operational form submissions when the browser reports no connection.
- Alternatives considered: Cache the authenticated application shell and recent data, omit the service worker entirely, or add background synchronization for queued operations.
- Reason: A static fallback supports a clear installed-app experience without creating stale financial operations, cross-user device leakage, queued double submissions, or an unsupported offline mode.
- Consequences: A cold offline launch displays only the connection notice; all customer and loyalty operations require restored connectivity. Any future offline capability requires explicit product authorization and a new security design.
- Status: Accepted.

## DEC-0011 - Cumulative Reward Tiers With A Highest-Tier Cycle Boundary

- Date: 2026-08-02
- Context: A tenant must be able to offer small rewards at intermediate stamp totals while preserving progress toward a larger reward, and customer cards must explain both the prize ladder and its terms.
- Decision: A loyalty program has one to ten uniquely ordered reward tiers. Each tier is granted at most once per customer cycle. Intermediate rewards accumulate without subtracting stamps; the highest threshold completes the cycle, preserves the remainder, and permits lower tiers in the next cycle to be reached in the same operation. Existing single-reward programs remain valid as one-tier programs. Terms and the active tier catalog are exposed through the public card projection.
- Alternatives considered: Deduct stamps for every small reward, make customers choose a reward, reset progress at every tier, or create separate loyalty programs per prize.
- Reason: The selected model supports progressive engagement without weakening atomic balance accounting, cancellation safety, or the existing remainder behavior.
- Consequences: Rewards store immutable tier, cycle, threshold, and program-version snapshots; purchases and adjustments record completed cycles separately from the number of rewards generated; changing active tiers creates an audited program-change boundary when it converts existing progress.
- Status: Accepted.

## DEC-0012 - Branch-Scoped Administration And Shared PIN Access

- Date: 2026-08-06
- Context: Branch Administrators need personal administrative accounts, while restaurant staff at selected branches must operate from a shared device account without individual email addresses.
- Decision: Preserve `MANAGER` internally and present it as Administrador de sucursal. Add an exclusive employee access mode per branch: individual credentials or one shared Auth account followed by a hashed six-digit operator PIN. A server-side HttpOnly token binds the unlocked operator to the shared Auth account and branch; RLS rejects the shared JWT without that token.
- Alternatives considered: New database role, one tenant-wide shared credential, storing reversible employee passwords, or attributing every action only to the shared account.
- Reason: The design preserves applied migrations and existing individual accounts while maintaining branch isolation and human attribution for loyalty operations.
- Consequences: Shared accounts are technical `EMPLOYEE` profiles, PIN sessions are revocable and expire after eight hours of inactivity, five failed attempts lock PIN entry for five minutes, and operational records store both the technical account and PIN operator.
- Status: Accepted.

## DEC-0013 - Tenant-Owned Apple Store Cards With Server-Only Signing

- Date: 2026-08-06
- Context: Tenants need distinct Apple Wallet designs while Apple constrains pass layouts and requires a signed local-resource bundle.
- Decision: Use one audited `storeCard` design per tenant, managed only by the Admin general. Generate `.pkpass` files on demand from the secure public card token, resize bounded HTTPS assets only from configured hosts, and keep the Pass Type ID, Team ID, signer certificate, private key, WWDR certificate, and password exclusively in server secrets.
- Alternatives considered: Arbitrary drag-and-drop layouts, storing certificates in the database, accepting unrestricted image URLs, or issuing unsigned passes.
- Reason: The fixed store-card model matches loyalty semantics, preserves tenant branding within Apple's supported fields, and keeps signing and tenant authority outside the browser.
- Consequences: The public download is visible only when both the tenant design and server signing config are enabled. Initial generation works without an Apple update web service; installed-pass updates and real-device validation remain separate Phase 8 work.
- Status: Accepted.

## DEC-0014 - Tenant-Scoped Public Wallet Asset Bucket

- Date: 2026-08-07
- Context: Admins need to upload Apple Wallet logos and strip images from the tenant configuration without copying external URLs, while the pass generator must fetch those assets without exposing privileged Storage credentials.
- Decision: Store Wallet raster assets in one public-read Supabase Storage bucket named `wallet-assets`, under generated `tenant_id/apple` object paths. Limit insert, update, and delete with Storage RLS to the active Admin general of that tenant; accept only PNG, JPEG, or WebP up to 5 MB and validate the submitted public URL again on the server before saving the design.
- Alternatives considered: Service-role uploads through Server Actions, private objects with signed URLs, one bucket per tenant, unrestricted external URLs, or storing image bytes in PostgreSQL.
- Reason: Direct browser uploads avoid Server Action body limits, public reads give the pass generator stable HTTPS assets, and tenant-path RLS preserves write isolation without proliferating buckets or exposing the service role.
- Consequences: Wallet images are intentionally public brand assets; replacing or clearing a saved design removes the previous tenant-owned object, failed submissions clean new objects when possible, and additional non-Supabase asset hosts still require `APPLE_WALLET_ASSET_HOSTS`.
- Status: Accepted.
