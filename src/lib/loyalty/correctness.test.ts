import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0031_loyalty_correctness.sql", import.meta.url),
  "utf8",
);
const redeemPage = readFileSync(
  new URL("../../app/app/redeem/page.tsx", import.meta.url),
  "utf8",
);

describe("loyalty correctness", () => {
  it("expires due rewards before display or redemption", () => {
    expect(migration).toContain("app.expire_due_rewards");
    expect(migration).toContain("return query select 'EXPIRED'");
    expect(migration).toContain("r.expires_at is null or r.expires_at > now()");
    expect(redeemPage).toContain('rpc("expire_due_rewards")');
    expect(redeemPage).toContain("expires_at.gt.");
  });

  it("generates rewards from positive adjustments and lower goals", () => {
    expect(migration).toContain("source_adjustment_id");
    expect(migration).toContain("rewards_single_generation_source");
    expect(migration).toContain("rewards_cancellation_consistency");
    expect(migration).toContain("rewards_generated");
    expect(migration).toContain("projected_balance % program_record.reward_stamp_goal");
    expect(migration).toContain(
      "balance_record.stamp_balance % program_record.reward_stamp_goal",
    );
    expect(migration).toContain("'PROGRAM_CHANGE'");
    expect(migration).toContain("pg_advisory_xact_lock_shared");
    expect(migration).toContain("PROGRAM_PAUSED");
  });

  it("records accurate reward and program audit events", () => {
    expect(migration).toContain("REWARD_GENERATED");
    expect(migration).toContain("REWARD_EXPIRED");
    expect(migration).toContain("LOYALTY_PROGRAM_UPDATED");
    expect(migration).toContain("cancellation_reason = btrim(target_reason)");
    expect(migration).toContain("'previous_reward_stamp_goal'");
  });
});
