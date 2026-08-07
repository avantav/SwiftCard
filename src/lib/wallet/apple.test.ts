import { readFileSync } from "node:fs";
import { PKPass } from "passkit-generator";
import { describe, expect, it } from "vitest";
import { buildAppleWalletPassProps } from "./apple";

describe("Apple Wallet store card", () => {
  it("maps loyalty data to an Apple store card without exposing personal identifiers", () => {
    const props = buildAppleWalletPassProps(
      {
        serialNumber: "card-id",
        tenantName: "Café Central",
        brandingMode: "STANDARD",
        logoText: "Café Central",
        description: "Tarjeta de recompensas",
        backgroundColor: "#17202A",
        foregroundColor: "#FFFFFF",
        labelColor: "#FFFFFF",
        customerName: "Ana López",
        programName: "Club Café",
        stampBalance: 4,
        rewardGoal: 10,
        availableRewards: 1,
        termsAndConditions: "Válido en sucursales participantes.",
        rewardTiers: [
          { stampsRequired: 10, name: "Bebida", description: "Una bebida" },
          { stampsRequired: 3, name: "Extra", description: "Un extra" },
        ],
        cardUrl: "https://wallet.example.com/card/public-token",
        locations: [{ latitude: 23.2, longitude: -106.4, relevantText: "Café Central" }],
      },
      { passTypeIdentifier: "pass.com.example", teamIdentifier: "TEAM123" },
    );
    expect(props.storeCard.primaryFields[0]?.value).toBe(4);
    expect(props.storeCard.backFields[1]?.value).toContain("3 sellos");
    expect(props.barcodes[0]?.message).toBe(
      "https://wallet.example.com/card/public-token",
    );
    expect(JSON.stringify(props)).not.toContain("customer-id");
    expect(props.locations).toHaveLength(1);

    const { storeCard, ...baseProps } = props;
    const pass = new PKPass(
      {
        "icon.png": readFileSync(
          new URL("../../../public/icons/apple-touch-icon.png", import.meta.url),
        ),
      },
      undefined,
      baseProps,
    );
    pass.type = "storeCard";
    pass.primaryFields.push(...storeCard.primaryFields);
    expect(pass.type).toBe("storeCard");
    expect(pass.primaryFields[0]?.value).toBe(4);
  });

  it("omits SwiftWallet attribution for white-label tenants", () => {
    const base = {
      serialNumber: "card-id",
      tenantName: "Tenant",
      brandingMode: "WHITE_LABEL" as const,
      logoText: "Tenant",
      description: "Tarjeta de recompensas",
      backgroundColor: "#000000",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFFFFF",
      customerName: "Cliente",
      programName: "Programa",
      stampBalance: 0,
      rewardGoal: null,
      availableRewards: 0,
      termsAndConditions: "Términos vigentes.",
      rewardTiers: [],
      cardUrl: "https://example.com/card/token",
      locations: [],
    };
    const props = buildAppleWalletPassProps(base, {
      passTypeIdentifier: "pass.com.example",
      teamIdentifier: "TEAM123",
    });
    expect(JSON.stringify(props)).not.toContain("SwiftWallet");
  });
});
