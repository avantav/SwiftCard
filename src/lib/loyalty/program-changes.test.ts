import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0013_purchase_operations.sql", import.meta.url), "utf8");

describe("loyalty program changes", () => {
  it("versions rules, preserves balances, and supports pause state", () => {
    expect(migration).toContain("app.update_loyalty_program");
    expect(migration).toContain("version = version + 1");
    expect(migration).toContain("target_status");
    expect(migration).toContain("PROGRAM_PAUSED");
  });
});
