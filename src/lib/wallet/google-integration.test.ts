import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  new URL("../../app/api/wallet/google/[cardToken]/route.ts", import.meta.url),
  "utf8",
);
const server = readFileSync(new URL("./google-server.ts", import.meta.url), "utf8");
const source = readFileSync(
  new URL("./google-pass-source.ts", import.meta.url),
  "utf8",
);
const claimAction = readFileSync(
  new URL("../../app/card/[cardToken]/actions.ts", import.meta.url),
  "utf8",
);
const googleButton = readFileSync(
  new URL("../../components/google-wallet-add-button.tsx", import.meta.url),
  "utf8",
);
const badge = readFileSync(
  new URL("../../../public/icons/add-to-google-wallet-es-419.svg", import.meta.url),
  "utf8",
);

describe("Google Wallet integration boundary", () => {
  it("keeps credentials and Google API synchronization server-only", () => {
    expect(server).toContain('import "server-only"');
    expect(server).toContain("GOOGLE_WALLET_SERVICE_ACCOUNT");
    expect(server).toContain("oauth2.googleapis.com/token");
    expect(server).toContain("walletobjects.googleapis.com/walletobjects/v1");
    expect(server).toContain('aud: "google"');
    expect(server).toContain('typ: "savetowallet"');
    expect(server).toContain("loyaltyObjects");
    expect(googleButton).not.toContain("GOOGLE_WALLET_SERVICE_ACCOUNT");
  });

  it("requires accepted terms and records the provider-neutral pass", () => {
    expect(route).toContain("public_card_terms_are_accepted");
    expect(route).toContain('provider: "GOOGLE"');
    expect(route).toContain("syncGoogleWalletPass");
    expect(route).toContain("NextResponse.redirect(result.saveUrl, 302)");
    expect(claimAction).toContain('destination === "GOOGLE"');
    expect(source).toContain("!configuration.wallet_enabled");
  });

  it("uses the official localized Google Wallet badge asset", () => {
    expect(googleButton).toContain("add-to-google-wallet-es-419.svg");
    expect(badge).toContain('<svg width="239" height="55"');
    expect(badge).toContain("#1F1F1F");
  });
});
