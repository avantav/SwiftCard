import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  appleDeviceIdentifierHash,
  applePassAuthenticationToken,
  applePassAuthorizationMatches,
  applePushTokenHash,
  decodeAppleWalletUpdateSecret,
  decryptApplePushToken,
  encryptApplePushToken,
} from "./apple-update-crypto";

describe("Apple Wallet update secrets", () => {
  it("derives stable, purpose-separated hashes without storing provider values", () => {
    const secret = randomBytes(32);
    const passToken = applePassAuthenticationToken(secret, "serial-1");
    expect(passToken).toBe(applePassAuthenticationToken(secret, "serial-1"));
    expect(passToken).not.toBe(applePassAuthenticationToken(secret, "serial-2"));
    expect(appleDeviceIdentifierHash(secret, "same-value")).not.toBe(
      applePushTokenHash(secret, "same-value"),
    );
    expect(applePassAuthorizationMatches(`ApplePass ${passToken}`, passToken)).toBe(true);
    expect(applePassAuthorizationMatches("ApplePass wrong", passToken)).toBe(false);
  });

  it("encrypts push tokens with authenticated random nonces", () => {
    const secret = randomBytes(32);
    const first = encryptApplePushToken(secret, "provider-push-token");
    const second = encryptApplePushToken(secret, "provider-push-token");
    expect(first).not.toBe(second);
    expect(first).not.toContain("provider-push-token");
    expect(decryptApplePushToken(secret, first)).toBe("provider-push-token");
    expect(() => decryptApplePushToken(randomBytes(32), first)).toThrow();
  });

  it("requires an exact 32-byte Base64 update secret", () => {
    const value = randomBytes(32).toString("base64");
    expect(decodeAppleWalletUpdateSecret(value)).toHaveLength(32);
    expect(() => decodeAppleWalletUpdateSecret(undefined)).toThrow(
      "APPLE_WALLET_UPDATE_SECRET_BASE64",
    );
    expect(() => decodeAppleWalletUpdateSecret(Buffer.alloc(31).toString("base64"))).toThrow(
      "32 bytes",
    );
  });
});
