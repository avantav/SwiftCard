import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const seed = readFileSync(new URL("../../../supabase/seed.sql", import.meta.url), "utf8");

describe("authenticated entrypoint", () => {
  it("redirects authenticated users by role and keeps public links separate", () => {
    expect(home).toContain("getStaffSessionContext");
    expect(home).toContain("getDefaultInternalRoute");
    expect(home).toContain("/login");
    expect(home).not.toContain("/admin/dashboard\",\n    label");
  });

  it("provides development-only role seed accounts", () => {
    expect(seed).toContain("Development-only seed");
    expect(seed).toContain("superadmin@example.test");
    expect(seed).toContain("admin@example.test");
    expect(seed).toContain("manager@example.test");
    expect(seed).toContain("employee@example.test");
    expect(seed).toContain("SUPERADMIN");
  });
});
