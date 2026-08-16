import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registrationPage = readFileSync(
  new URL("../../app/register/[branchToken]/page.tsx", import.meta.url),
  "utf8",
);
const button = readFileSync(
  new URL("../../components/apple-wallet-add-button.tsx", import.meta.url),
  "utf8",
);
const success = readFileSync(
  new URL("../../components/public-registration-success.tsx", import.meta.url),
  "utf8",
);
const availability = readFileSync(
  new URL("./public-availability.ts", import.meta.url),
  "utf8",
);

describe("Apple Wallet after public registration", () => {
  it("offers the signed pass directly instead of opening the Web Card", () => {
    expect(registrationPage).toContain("PublicRegistrationSuccess");
    expect(registrationPage).toContain("appleWalletAvailable");
    expect(registrationPage).toContain('created === "1"');
    expect(registrationPage).not.toContain("/card/");
    expect(success).toContain("AppleWalletAddButton");
    expect(button).toContain("?claim=1");
    expect(button).toContain("/api/wallet/apple/");
    expect(button).toContain("public-apple-wallet-icon");
    expect(button).toContain("Apple Wallet");
  });

  it("checks server and tenant availability before exposing the action", () => {
    expect(availability).toContain('import "server-only"');
    expect(availability).toContain('walletProviderConfig("APPLE").configured');
    expect(availability).toContain("public_apple_wallet_is_enabled");
    expect(availability).toContain("target_card_token: cardToken");
  });
});
