import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  appleWalletPointProgress,
  buildAppleWalletPointStrips,
} from "./apple-point-strip";

describe("Apple Wallet graphical point progress", () => {
  it("clamps progress to the current milestone", () => {
    expect(appleWalletPointProgress(200, 300)).toBeCloseTo(2 / 3);
    expect(appleWalletPointProgress(400, 300)).toBe(1);
    expect(appleWalletPointProgress(-5, 300)).toBe(0);
    expect(appleWalletPointProgress(10, null)).toBe(0);
  });

  it("renders a distinct progress bar at every signed-pass strip scale", async () => {
    const base = {
      backgroundColor: "#006B22",
      foregroundColor: "#FFFFFF",
      nextGoal: 300,
      backgroundSource: null,
    };
    const twoHundred = await buildAppleWalletPointStrips({
      ...base,
      pointBalance: 200,
    });
    const twoHundredFifty = await buildAppleWalletPointStrips({
      ...base,
      pointBalance: 250,
    });

    await expect(sharp(twoHundred["strip.png"]).metadata()).resolves.toMatchObject({
      width: 375,
      height: 144,
      format: "png",
    });
    await expect(sharp(twoHundred["strip@2x.png"]).metadata()).resolves.toMatchObject({
      width: 750,
      height: 288,
    });
    await expect(sharp(twoHundred["strip@3x.png"]).metadata()).resolves.toMatchObject({
      width: 1125,
      height: 432,
    });
    expect(twoHundred["strip.png"].equals(twoHundredFifty["strip.png"])).toBe(false);
  });
});
