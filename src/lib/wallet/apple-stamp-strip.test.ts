import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  APPLE_WALLET_MAX_VISIBLE_STAMPS,
  appleWalletStampLayout,
  appleWalletStampRows,
  appleWalletStampSlots,
  normalizeAppleWalletStampRows,
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
    expect(appleWalletStampLayout(10)).toEqual({
      columns: 5,
      diameter: 46,
      gap: 14,
      rows: [5, 5],
    });
    expect(appleWalletStampLayout(24).columns).toBe(8);
    expect(appleWalletStampRows(6, 5)).toEqual([[0, 1, 2, 3, 4], [5]]);
    expect(normalizeAppleWalletStampRows(10, [3, 3])).toEqual([3, 3, 4]);
    expect(appleWalletStampLayout(10, [3, 3, 4]).rows).toEqual([3, 3, 4]);
  });

  it("renders custom row positions and optional empty slots into signed assets", async () => {
    const base = {
      backgroundColor: "#17202A",
      foregroundColor: "#FFFFFF",
      rewardGoal: 10,
      stampBalance: 4,
      tenantName: "Café Central",
      logoSource: logo,
      backgroundSource: null,
      stampRows: [3, 3, 4],
    };
    const centered = await buildAppleWalletStampStrips(base);
    const moved = await buildAppleWalletStampStrips({
      ...base,
      stampPositionXPercent: 30,
      stampPositionYPercent: 65,
    });
    const withoutEmptySlots = await buildAppleWalletStampStrips({
      ...base,
      showEmptyStamps: false,
    });

    expect(centered["strip.png"].equals(moved["strip.png"])).toBe(false);
    expect(centered["strip.png"].equals(withoutEmptySlots["strip.png"])).toBe(false);
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

  it("keeps the primary image free of stamp circles when stamps are hidden", async () => {
    const base = {
      backgroundColor: "#17202A",
      foregroundColor: "#FFFFFF",
      rewardGoal: 10,
      tenantName: "Café Central",
      logoSource: null,
      backgroundSource: null,
      showStamps: false,
    };
    const fourStamps = await buildAppleWalletStampStrips({ ...base, stampBalance: 4 });
    const fiveStamps = await buildAppleWalletStampStrips({ ...base, stampBalance: 5 });

    expect(fourStamps["strip.png"].equals(fiveStamps["strip.png"])).toBe(true);
    await expect(sharp(fourStamps["strip.png"]).metadata()).resolves.toMatchObject({
      width: 375,
      height: 144,
      format: "png",
    });
  });
});
