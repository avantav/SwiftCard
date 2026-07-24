import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0012_loyalty_schema.sql", import.meta.url), "utf8");

describe("loyalty schema", () => {
  it("defines minor-unit amounts, active-program uniqueness, and nonnegative balances", () => {
    expect(migration).toContain("loyalty_programs_one_active_per_tenant_idx");
    expect(migration).toContain("amount_minor bigint");
    expect(migration).toContain("stamp_balance integer not null default 0");
    expect(migration).toContain("stamp_balance >= 0");
    expect(migration).toContain("purchases_branch_ticket_unique_idx");
    expect(migration).toContain("alter table public.stamp_ledger force row level security");
  });
});
