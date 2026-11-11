import { describe, expect, it } from "vitest";
import {
  buildGoogleWalletResources,
  googleWalletResourceIds,
  type GoogleWalletPassData,
} from "./google";

const basePass: GoogleWalletPassData = {
  issuerId: "3388000000022290000",
  loyaltyCardId: "8e222233-4444-5555-8666-777788889999",
  customerCardId: "1a222233-4444-5555-8666-777788889999",
  tenantName: "Café Swift",
  programName: "Clientes frecuentes",
  customerName: "Ana Pérez",
  unitNameSingular: "sello",
  unitNamePlural: "sellos",
  balance: 4,
  availableRewards: 1,
  rewardGoal: 10,
  rewardTiers: [
    { stampsRequired: 10, name: "Bebida", description: "Una bebida" },
    { stampsRequired: 5, name: "Extra", description: "Un extra" },
  ],
  termsAndConditions: "Válido en sucursales participantes.",
  backgroundColor: "#149c91",
  logoUrl: "https://wallet.example.com/logo.png",
  heroImageUrl: "https://wallet.example.com/hero.png",
  cardUrl: "https://wallet.example.com/card/opaque-token",
  scanUrl: "https://wallet.example.com/scan/q1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  active: true,
  merchantLocations: Array.from({ length: 12 }, (_, index) => ({
    latitude: 23 + index / 100,
    longitude: -106 - index / 100,
  })),
  latestActivity: "¡Gracias por tu compra! Sumaste 1 sello. Ahora tienes 4 sellos.",
};

describe("Google Wallet loyalty resources", () => {
  it("creates stable issuer-scoped IDs", () => {
    expect(
      googleWalletResourceIds(
        basePass.issuerId,
        basePass.loyaltyCardId,
        basePass.customerCardId,
      ),
    ).toEqual({
      classId:
        "3388000000022290000.swiftwallet_card_8e222233-4444-5555-8666-777788889999",
      objectId:
        "3388000000022290000.swiftwallet_customer_1a222233-4444-5555-8666-777788889999",
    });
  });

  it("maps the shared card model into a loyalty class and object", () => {
    const result = buildGoogleWalletResources(basePass);

    expect(result.loyaltyClass).toMatchObject({
      id: result.classId,
      issuerName: "Café Swift",
      reviewStatus: "UNDER_REVIEW",
      hexBackgroundColor: "#149C91",
    });
    expect(result.loyaltyObject).toMatchObject({
      id: result.objectId,
      classId: result.classId,
      state: "ACTIVE",
      accountName: "Ana Pérez",
      loyaltyPoints: { label: "sellos", balance: { int: 4 } },
      secondaryLoyaltyPoints: { label: "Premios", balance: { int: 1 } },
      barcode: {
        type: "QR_CODE",
        value: "https://wallet.example.com/scan/q1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    });
    expect(result.loyaltyObject.merchantLocations).toHaveLength(10);
    expect(result.loyaltyObject.textModulesData[0]).toEqual({
      id: "latest-activity",
      header: "Última actividad",
      body: "¡Gracias por tu compra! Sumaste 1 sello. Ahora tienes 4 sellos.",
    });
    expect(result.loyaltyObject.textModulesData[2].body).toContain(
      "5 sellos: Extra\n10 sellos: Bebida",
    );
    expect(JSON.stringify(result)).not.toContain("service_account");
  });

  it("rejects unsafe public URLs and invalid issuer IDs", () => {
    expect(() =>
      buildGoogleWalletResources({
        ...basePass,
        cardUrl: "http://localhost:3000/card/token",
        scanUrl: "https://wallet.example.com/scan/q1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      }),
    ).toThrow("Invalid Google Wallet pass data");
    expect(() => googleWalletResourceIds("issuer", "card", "customer")).toThrow(
      "Invalid Google Wallet issuer ID",
    );
  });
});
