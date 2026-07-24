import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0021_reward_cancellation.sql", import.meta.url), "utf8");

describe("reward cancellation", () => {
  it("is Admin-only and does not alter balances", () => {
    expect(migration).toContain("app.cancel_reward");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).toContain("reward_record.status <> 'AVAILABLE'");
    expect(migration).toContain("REWARD_CANCELLED");
  });
});
