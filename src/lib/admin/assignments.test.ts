import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
  join(process.cwd(), "src/app/admin/staff/assignments.ts"),
  "utf8"
);
const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/0005_staff_branch_assignments.sql"),
  "utf8"
);

describe("staff branch assignment boundary", () => {
  it("uses the authenticated Admin context and the atomic RPC", () => {
    expect(actionSource).toContain('requireInternalArea("ADMIN")');
    expect(actionSource).toContain('"set_staff_branch_assignment"');
    expect(actionSource).not.toContain('formData.get("tenant');
  });

  it("locks per staff member and validates active tenant branches", () => {
    expect(migrationSource).toContain("pg_advisory_xact_lock");
    expect(migrationSource).toContain("b.tenant_id = current_tenant_id");
    expect(migrationSource).toContain("b.status = 'ACTIVE'");
    expect(migrationSource).toContain("grant execute");
  });
});
