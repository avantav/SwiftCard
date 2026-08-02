import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync(
  join(process.cwd(), "scripts/bootstrap-superadmin.mjs"),
  "utf8"
);

describe("hosted Supabase bootstrap", () => {
  it("creates Auth before the Superadmin profile and compensates failures", () => {
    const authCreate = bootstrap.indexOf("auth.admin.createUser");
    const profileCreate = bootstrap.indexOf('.from("staff_profiles").insert');
    const authCleanup = bootstrap.indexOf("auth.admin.deleteUser");

    expect(authCreate).toBeGreaterThan(-1);
    expect(profileCreate).toBeGreaterThan(authCreate);
    expect(authCleanup).toBeGreaterThan(profileCreate);
    expect(bootstrap).toContain("email_confirm: true");
    expect(bootstrap).toContain('role: "SUPERADMIN"');
    expect(bootstrap).toContain("tenant_id: null");
  });

  it("requires a non-committed bootstrap password", () => {
    expect(bootstrap).toContain("SWIFTWALLET_BOOTSTRAP_SUPERADMIN_PASSWORD");
    expect(bootstrap).not.toContain("SwiftWalletDev!2026");
  });
});
