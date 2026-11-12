import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  ownedBranchIds: new Set<string>(),
  sharedAccountFilters: [] as Array<Record<string, unknown>>,
  updateUserById: vi.fn(async () => ({ error: null })),
  createUser: vi.fn(async () => ({ data: { user: { id: "new-shared-user" } }, error: null })),
  deleteUser: vi.fn(async () => ({ error: null })),
  rpc: vi.fn(async () => ({ data: "CONFIGURED", error: null })),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/wallet/apple-apns", () => ({ dispatchAppleWalletUpdatesBestEffort: vi.fn() }));

function sessionClient() {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
        maybeSingle: async () => {
          const owned = table === "branches"
            && filters.tenant_id === "tenant-a"
            && state.ownedBranchIds.has(String(filters.id));
          return { data: owned ? { id: filters.id } : null, error: null };
        },
      };
      return builder;
    },
    schema: () => ({ rpc: state.rpc }),
  };
}

vi.mock("@/lib/auth/server", () => ({
  requireInternalArea: vi.fn(async () => ({
    access: { role: "ADMIN" },
    tenantId: "tenant-a",
    supabase: sessionClient(),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
        maybeSingle: async () => {
          state.sharedAccountFilters.push({ ...filters });
          // Another tenant's branch has an existing shared account.
          return { data: filters.branch_id === "branch-of-tenant-b" ? { staff_profile_id: "victim-user" } : null, error: null };
        },
      };
      return builder;
    },
    auth: { admin: { updateUserById: state.updateUserById, createUser: state.createUser, deleteUser: state.deleteUser } },
  }),
}));

import { configureBranchAccess } from "@/app/admin/branches/actions";

function form(branchId: string, mode = "SHARED_ACCOUNT_PIN") {
  const data = new FormData();
  data.set("branchId", branchId);
  data.set("employeeAccessMode", mode);
  data.set("sharedEmail", "attacker@example.com");
  data.set("sharedPassword", "una-clave-larga-1");
  data.set("sharedPasswordConfirmation", "una-clave-larga-1");
  return data;
}

describe("configureBranchAccess tenant isolation (SEC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ownedBranchIds = new Set(["branch-of-tenant-a"]);
    state.sharedAccountFilters = [];
  });

  it("rejects another tenant's branch before any service-role read or Auth change", async () => {
    await expect(configureBranchAccess(form("branch-of-tenant-b"))).rejects.toThrow(
      /REDIRECT:\/admin\/branches\?error=La%20sucursal%20no%20existe/,
    );
    expect(state.sharedAccountFilters).toEqual([]);
    expect(state.updateUserById).not.toHaveBeenCalled();
    expect(state.createUser).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("does not ban another tenant's shared account when switching to individual access", async () => {
    await expect(configureBranchAccess(form("branch-of-tenant-b", "INDIVIDUAL_CREDENTIALS"))).rejects.toThrow(/REDIRECT:.*error=/);
    expect(state.updateUserById).not.toHaveBeenCalled();
  });

  it("configures the admin's own branch with tenant-scoped service-role lookups", async () => {
    await expect(configureBranchAccess(form("branch-of-tenant-a"))).rejects.toThrow(/REDIRECT:\/admin\/branches\?accessUpdated=1/);
    expect(state.sharedAccountFilters).toEqual([{ branch_id: "branch-of-tenant-a", tenant_id: "tenant-a" }]);
    expect(state.createUser).toHaveBeenCalledOnce();
    expect(state.rpc).toHaveBeenCalledWith("configure_branch_shared_access", expect.objectContaining({ target_branch_id: "branch-of-tenant-a" }));
  });
});
