# SwiftWallet

SwiftWallet is a multi-tenant SaaS MVP for digital loyalty programs. The product source is `docs/PRODUCT.md`; continuity for autonomous development lives in `docs/`.

## Development

```bash
npm install
npm run dev
```

## Quality

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## RLS Verification

Docker and the local `postgres:16-alpine` image are required. The command starts
an isolated PostgreSQL container, applies the Phase 1 migration, runs positive
and negative tenant/branch access assertions, and removes the container.

```bash
npm run db:verify-rls
```
