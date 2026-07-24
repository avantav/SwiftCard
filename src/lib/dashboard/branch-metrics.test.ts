import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0023_dashboard_branch_metrics.sql", import.meta.url), "utf8");

describe("dashboard branch metrics", () => {
  it("scopes branch comparisons to the authenticated role", () => {
    expect(migration).toContain("app.get_dashboard_branch_metrics");
    expect(migration).toContain("staff_record.role not in ('ADMIN', 'MANAGER')");
    expect(migration).toContain("staff_branch_assignments");
    expect(migration).toContain("purchase_amount_minor");
  });
});
