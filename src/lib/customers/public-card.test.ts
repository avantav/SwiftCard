import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0011_public_web_card.sql", import.meta.url), "utf8");
const loyaltyProjection = readFileSync(new URL("../../../supabase/migrations/0034_tiered_rewards_and_card_terms.sql", import.meta.url), "utf8");
const cardComponent = readFileSync(new URL("../../components/public-wallet-card.tsx", import.meta.url), "utf8");

describe("public web card projection", () => {
  it("projects current loyalty state without private customer data", () => {
    expect(loyaltyProjection).toContain("program_name text");
    expect(loyaltyProjection).toContain("stamp_balance integer");
    expect(loyaltyProjection).toContain("available_rewards jsonb");
    expect(loyaltyProjection).toContain("terms_and_conditions text");
    expect(loyaltyProjection).toContain("reward_tiers jsonb");
    expect(loyaltyProjection).toContain("c.status = 'ACTIVE'");
    expect(loyaltyProjection).not.toContain("normalized_phone");
    expect(loyaltyProjection).toContain("grant execute on function app.get_public_web_card(text) to anon");
    expect(cardComponent).toContain("Premios por número de sellos");
    expect(cardComponent).toContain("Términos y condiciones");
    expect(cardComponent).toContain("Código QR para identificar esta tarjeta");
    expect(cardComponent).not.toContain('<div>QR</div>');
  });
  it("only grants the projection to anon and filters active tokens", () => {
    expect(migration).toContain("app.get_public_web_card");
    expect(migration).toContain("cc.status = 'ACTIVE'");
    expect(migration).toContain("t.status = 'ACTIVE'");
    expect(migration).toContain("to anon");
    expect(migration).not.toContain("normalized_phone");
  });
});
