import sharp from "sharp";

export type AppleWalletImageLayout = {
  scalePercent: number;
  marginXPercent: number;
  marginYPercent: number;
};

export const DEFAULT_APPLE_WALLET_IMAGE_LAYOUT: AppleWalletImageLayout = {
  scalePercent: 100,
  marginXPercent: 0,
  marginYPercent: 0,
};

export function appleWalletImageViewport(
  width: number,
  height: number,
  layout: AppleWalletImageLayout,
) {
  const marginX = Math.round(width * (layout.marginXPercent / 100));
  const marginY = Math.round(height * (layout.marginYPercent / 100));
  const viewportWidth = Math.max(1, width - marginX * 2);
  const viewportHeight = Math.max(1, height - marginY * 2);
  return {
    left: marginX,
    top: marginY,
    viewportWidth,
    viewportHeight,
    scaledWidth: Math.max(1, Math.round(viewportWidth * (layout.scalePercent / 100))),
    scaledHeight: Math.max(1, Math.round(viewportHeight * (layout.scalePercent / 100))),
  };
}

async function imageInsideViewport(
  source: Buffer,
  viewportWidth: number,
  viewportHeight: number,
  scaledWidth: number,
  scaledHeight: number,
  fit: "contain" | "cover",
) {
  const resized = await sharp(source, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(scaledWidth, scaledHeight, {
      fit,
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  if (scaledWidth >= viewportWidth && scaledHeight >= viewportHeight) {
    return sharp(resized)
      .extract({
        left: Math.floor((scaledWidth - viewportWidth) / 2),
        top: Math.floor((scaledHeight - viewportHeight) / 2),
        width: viewportWidth,
        height: viewportHeight,
      })
      .png()
      .toBuffer();
  }

  return sharp({
    create: {
      width: viewportWidth,
      height: viewportHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: resized,
      left: Math.floor((viewportWidth - scaledWidth) / 2),
      top: Math.floor((viewportHeight - scaledHeight) / 2),
    }])
    .png()
    .toBuffer();
}

export async function renderAppleWalletPositionedImage(
  source: Buffer,
  width: number,
  height: number,
  layout: AppleWalletImageLayout,
  options: {
    fit: "contain" | "cover";
    background: string | { r: number; g: number; b: number; alpha: number };
  },
) {
  const viewport = appleWalletImageViewport(width, height, layout);
  const image = await imageInsideViewport(
    source,
    viewport.viewportWidth,
    viewport.viewportHeight,
    viewport.scaledWidth,
    viewport.scaledHeight,
    options.fit,
  );
  return sharp({
    create: { width, height, channels: 4, background: options.background },
  })
    .composite([{ input: image, left: viewport.left, top: viewport.top }])
    .png()
    .toBuffer();
}
