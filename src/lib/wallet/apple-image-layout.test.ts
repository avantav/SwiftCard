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

  it("clips zoomed content inside the fixed provider canvas", async () => {
    const source = await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#FF0000" },
    }).png().toBuffer();
    const output = await renderAppleWalletPositionedImage(
      source,
      375,
      144,
      { scalePercent: 150, marginXPercent: 10, marginYPercent: 10 },
      { fit: "cover", background: "#0000FF" },
    );
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    const rgbaAt = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return Array.from(data.subarray(offset, offset + 4));
    };

    expect(rgbaAt(0, 0)).toEqual([0, 0, 255, 255]);
    expect(rgbaAt(187, 72)).toEqual([255, 0, 0, 255]);
    expect(info).toMatchObject({ width: 375, height: 144, channels: 4 });
  });
});
