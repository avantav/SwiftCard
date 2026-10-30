import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = source("../../../supabase/migrations/0067_superadmin_support_sessions.sql");
const server = source("./server.ts");
const middleware = source("../../../middleware.ts");
const superadmin = source("../../app/superadmin/page.tsx");
const adminLayout = source("../../app/admin/layout.tsx");
const startRoute = source("../../app/support/start/route.ts");
const authServer = source("./server.ts");
const branchesPage = source("../../app/admin/branches/page.tsx");

describe("Superadmin support mode", () => {
  it("stores only a hashed, expiring token and audits the lifecycle", () => {
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("expires_at <= created_at + interval '1 hour'");
    expect(migration).toContain("SUPPORT_IMPERSONATION_STARTED");
    expect(migration).toContain("SUPPORT_IMPERSONATION_ENDED");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on public.support_impersonation_sessions");
  });

  it("keeps the real Superadmin identity and derives an effective tenant context", () => {
    expect(server).toContain("actorAccess");
    expect(server).toContain('role: "ADMIN"');
    expect(server).toContain("supportSession?.tenantId");
    expect(server).toContain("get_support_impersonation_session");
  });

  it("exposes explicit entry and exit while blocking tenant mutations", () => {
    expect(superadmin).toContain("Entrar en modo soporte");
    expect(adminLayout).toContain("Sucursales y ubicación/GPS editables");
    expect(adminLayout).toContain('action="/support/exit"');
    expect(middleware).toContain("updateSupabaseSession");
    expect(startRoute).toContain("createSupportSessionToken");
    expect(startRoute).toContain("hashSupportSessionToken");
  });

  it("keeps support reads tenant-scoped and rejects server mutations", () => {
    expect(authServer).toContain("options.writable");
    expect(authServer).toContain("allowSupportWrites");
    expect(authServer).toContain('supportError=read_only');
    expect(branchesPage).toContain('.eq("tenant_id", context.tenantId)');
    expect(branchesPage).toContain("readOnlySupport");
  });
});
