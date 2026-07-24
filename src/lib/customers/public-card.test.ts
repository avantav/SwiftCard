import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0011_public_web_card.sql", import.meta.url), "utf8");
const loyaltyProjection = readFileSync(new URL("../../../supabase/migrations/0030_public_web_card_loyalty.sql", import.meta.url), "utf8");

describe("public web card projection", () => {
  it("projects current loyalty state without private customer data", () => {
    expect(loyaltyProjection).toContain("program_name text");
    expect(loyaltyProjection).toContain("stamp_balance integer");
    expect(loyaltyProjection).toContain("available_rewards jsonb");
    expect(loyaltyProjection).toContain("c.status = 'ACTIVE'");
    expect(loyaltyProjection).not.toContain("normalized_phone");
    expect(loyaltyProjection).toContain("grant execute on function app.get_public_web_card(text) to anon");
  });
  it("only grants the projection to anon and filters active tokens", () => {
    expect(migration).toContain("app.get_public_web_card");
    expect(migration).toContain("cc.status = 'ACTIVE'");
    expect(migration).toContain("t.status = 'ACTIVE'");
    expect(migration).toContain("to anon");
    expect(migration).not.toContain("normalized_phone");
  });
});
