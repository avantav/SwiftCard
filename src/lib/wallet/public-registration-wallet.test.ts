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
const googleButton = readFileSync(
  new URL("../../components/google-wallet-add-button.tsx", import.meta.url),
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

describe("mobile wallets after public registration", () => {
  it("offers the configured signed pass after accepting terms", () => {
    expect(registrationPage).toContain("PublicRegistrationSuccess");
    expect(registrationPage).toContain("appleWalletAvailable");
    expect(registrationPage).toContain("googleWalletAvailable");
    expect(registrationPage).toContain('created === "1"');
    expect(registrationPage).not.toContain("/card/");
    expect(success).toContain("AppleWalletAddButton");
    expect(button).toContain("?claim=1");
    expect(button).toContain("/api/wallet/apple/");
    expect(button).toContain("public-apple-wallet-icon");
    expect(button).toContain("Apple Wallet");
    expect(success).toContain("GoogleWalletAddButton");
    expect(googleButton).toContain("?claim=1");
    expect(googleButton).toContain("/api/wallet/google/");
  });

  it("checks server and tenant availability before exposing the action", () => {
    expect(availability).toContain('import "server-only"');
    expect(availability).toContain('isPublicWalletAvailable(cardToken, "APPLE")');
    expect(availability).toContain('isPublicWalletAvailable(cardToken, "GOOGLE")');
    expect(availability).toContain("public_apple_wallet_is_enabled");
    expect(availability).toContain("target_card_token: cardToken");
  });
});
