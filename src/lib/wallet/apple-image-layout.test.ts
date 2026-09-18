import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  appleWalletImageViewport,
  renderAppleWalletPositionedImage,
} from "./apple-image-layout";

describe("Apple Wallet image layout", () => {
  it("derives a bounded viewport from scale and margins", () => {
    expect(appleWalletImageViewport(375, 144, {
      scalePercent: 120,
      marginXPercent: 10,
      marginYPercent: 5,
    })).toEqual({
      left: 38,
      top: 7,
      viewportWidth: 299,
      viewportHeight: 130,
      scaledWidth: 359,
      scaledHeight: 156,
    });
  });

  it("keeps the required output size after applying safe-area margins", async () => {
    const source = await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#FF0000" },
    }).png().toBuffer();
    const output = await renderAppleWalletPositionedImage(
      source,
      375,
      144,
      { scalePercent: 75, marginXPercent: 10, marginYPercent: 10 },
      { fit: "cover", background: "#17202A" },
    );
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 375,
      height: 144,
      format: "png",
    });
  });
});
