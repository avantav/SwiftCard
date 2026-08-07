import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0022_dashboard_metrics.sql", import.meta.url), "utf8");

describe("dashboard metrics", () => {
  it("derives role scope and keeps monetary totals in minor units", () => {
    expect(migration).toContain("app.get_dashboard_metrics");
    expect(migration).toContain("staff_record.role not in ('ADMIN', 'MANAGER')");
    expect(migration).toContain("purchase_amount_minor bigint");
    expect(migration).toContain("accessible_branches");
    expect(migration).toContain("to authenticated");
  });
});
