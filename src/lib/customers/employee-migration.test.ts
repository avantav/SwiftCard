import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0009_employee_customer_registration.sql", import.meta.url), "utf8");

describe("employee registration migration", () => {
  it("derives staff identity and requires active assigned branches", () => {
    expect(migration).toContain("app.register_employee_customer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("app.current_staff_can_access_branch");
    expect(migration).toContain("b.status = 'ACTIVE'");
    expect(migration).toContain("'EMPLOYEE'");
    expect(migration).toContain("to authenticated");
  });
});
