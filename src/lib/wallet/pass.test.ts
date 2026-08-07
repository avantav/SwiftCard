import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWalletPassPayload } from "./pass";

const migration = readFileSync(new URL("../../../supabase/migrations/0029_wallet_passes.sql", import.meta.url), "utf8");

describe("wallet pass boundary", () => {
  it("builds provider-neutral payloads without secrets", () => {
    const payload = buildWalletPassPayload({ provider: "APPLE", serialNumber: " serial-1 ", tenantName: "Cafe", brandingMode: "STANDARD", logoUrl: null, primaryColor: "#149C91", secondaryColor: "#17202A", customerName: "Ana", cardToken: " token ", programName: "Programa Café", stampBalance: 2, rewardGoal: 10, termsAndConditions: "Válido en sucursales participantes.", rewardTiers: [{ stampsRequired: 10, name: "Bebida", description: "Una bebida" }, { stampsRequired: 3, name: "Extra", description: "Un extra" }] });
    expect(payload.serialNumber).toBe("serial-1");
    expect(payload.cardToken).toBe("token");
    expect(payload.rewardTiers.map((tier) => tier.stampsRequired)).toEqual([3, 10]);
    expect(payload.termsAndConditions).toContain("sucursales");
    expect(JSON.stringify(payload)).not.toContain("PASS_TYPE_ID");
  });

  it("keeps pass records tenant-scoped and client read-only", () => {
    expect(migration).toContain("create table public.wallet_passes");
    expect(migration).toContain("wallet_passes_staff_read");
    expect(migration).toContain("revoke all on public.wallet_passes from anon, authenticated");
    expect(migration).toContain("wallet_passes_provider_card_idx");
  });
});
