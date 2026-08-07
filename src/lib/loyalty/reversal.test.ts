import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0020_reversals_and_adjustments.sql", import.meta.url), "utf8");

describe("reversals and adjustments", () => {
  it("locks balances, requires reasons, and records reversals/adjustments", () => {
    expect(migration).toContain("app.reverse_reward_redemption");
    expect(migration).toContain("app.adjust_customer_stamps");
    expect(migration).toContain("NEGATIVE_BALANCE");
    expect(migration).toContain("'ADJUSTMENT'");
    expect(migration).toContain("REWARD_REDEMPTION_REVERSED");
  });
});
