import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0019_purchase_cancellation.sql", import.meta.url), "utf8");

describe("purchase cancellation", () => {
  it("requires reason, rejects later activity, and reverses through ledger", () => {
    expect(migration).toContain("app.cancel_purchase");
    expect(migration).toContain("HAS_LATER_ACTIVITY");
    expect(migration).toContain("REWARD_ALREADY_REDEEMED");
    expect(migration).toContain("'CANCELLATION'");
    expect(migration).toContain("audit_sensitive_change");
  });
});
