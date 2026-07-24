import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0013_purchase_operations.sql", import.meta.url), "utf8");

describe("purchase operations", () => {
  it("locks balances, derives staff access, and creates ledger/reward records server-side", () => {
    expect(migration).toContain("app.preview_purchase");
    expect(migration).toContain("app.confirm_purchase");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("stamp_ledger");
    expect(migration).toContain("rewards");
    expect(migration).toContain("to authenticated");
  });
});
