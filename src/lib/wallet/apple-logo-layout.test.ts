import { describe, expect, it } from "vitest";
import { appleWalletLogoDimensions } from "./apple-logo-layout";

describe("Apple Wallet logo layout", () => {
  it("uses a tight square canvas instead of centering the logo in 160 pixels", () => {
    expect(appleWalletLogoDimensions(512, 512)).toEqual({ width: 50, height: 50 });
  });

  it("preserves wide and tall aspect ratios within Apple's logo bounds", () => {
    expect(appleWalletLogoDimensions(640, 200)).toEqual({ width: 160, height: 50 });
    expect(appleWalletLogoDimensions(200, 800)).toEqual({ width: 13, height: 50 });
  });

  it("rejects invalid source dimensions", () => {
    expect(() => appleWalletLogoDimensions(0, 100)).toThrow();
    expect(() => appleWalletLogoDimensions(Number.NaN, 100)).toThrow();
  });
});
