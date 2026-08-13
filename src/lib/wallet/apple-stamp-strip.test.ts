import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  APPLE_WALLET_MAX_VISIBLE_STAMPS,
  appleWalletStampSlots,
  buildAppleWalletStampStrips,
} from "./apple-stamp-strip";

const logo = readFileSync(
  new URL("../../../public/icons/apple-touch-icon.png", import.meta.url),
);

describe("Apple Wallet graphical stamp strip", () => {
  it("keeps ordinary goals exact and bounds unusually large goals", () => {
    expect(appleWalletStampSlots(4, 10)).toEqual({
      goal: 10,
      earned: 4,
      visible: 10,
      filled: 4,
    });
    expect(appleWalletStampSlots(1, 100)).toEqual({
      goal: 100,
      earned: 1,
      visible: APPLE_WALLET_MAX_VISIBLE_STAMPS,
      filled: 1,
    });
    expect(appleWalletStampSlots(100, 100).filled).toBe(
      APPLE_WALLET_MAX_VISIBLE_STAMPS,
    );
  });

  it("renders current customer progress into every signed-pass strip scale", async () => {
    const base = {
      backgroundColor: "#17202A",
      foregroundColor: "#FFFFFF",
      rewardGoal: 10,
      tenantName: "Café Central",
      logoSource: logo,
      backgroundSource: null,
    };
    const fourStamps = await buildAppleWalletStampStrips({
      ...base,
      stampBalance: 4,
    });
    const fiveStamps = await buildAppleWalletStampStrips({
      ...base,
      stampBalance: 5,
    });

    await expect(sharp(fourStamps["strip.png"]).metadata()).resolves.toMatchObject({
      width: 375,
      height: 144,
      format: "png",
    });
    await expect(sharp(fourStamps["strip@2x.png"]).metadata()).resolves.toMatchObject({
      width: 750,
      height: 288,
    });
    await expect(sharp(fourStamps["strip@3x.png"]).metadata()).resolves.toMatchObject({
      width: 1125,
      height: 432,
    });
    expect(fourStamps["strip.png"].equals(fiveStamps["strip.png"])).toBe(false);
  });
});
