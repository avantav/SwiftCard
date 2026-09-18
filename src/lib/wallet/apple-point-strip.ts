import sharp from "sharp";
import {
  DEFAULT_APPLE_WALLET_IMAGE_LAYOUT,
  renderAppleWalletPositionedImage,
  type AppleWalletImageLayout,
} from "./apple-image-layout";

const stripSizes = [
  { name: "strip.png", width: 375, height: 144 },
  { name: "strip@2x.png", width: 750, height: 288 },
  { name: "strip@3x.png", width: 1125, height: 432 },
] as const;

type PointStripInput = {
  backgroundColor: string;
  foregroundColor: string;
  pointBalance: number;
  nextGoal: number | null;
  backgroundSource: Buffer | null;
  backgroundLayout?: AppleWalletImageLayout;
};

function safeHex(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

export function appleWalletPointProgress(balance: number, goal: number | null) {
  if (!goal || goal <= 0) return 0;
  return Math.min(1, Math.max(0, balance / goal));
}

async function renderPointStrip(
  input: PointStripInput,
  size: (typeof stripSizes)[number],
) {
  const scale = size.width / 375;
  const background = safeHex(input.backgroundColor, "#17202A");
  const foreground = safeHex(input.foregroundColor, "#FFFFFF");
  const progress = appleWalletPointProgress(input.pointBalance, input.nextGoal);
  const trackX = 28 * scale;
  const trackY = 112 * scale;
  const trackWidth = 319 * scale;
  const trackHeight = 10 * scale;
  const fillWidth = trackWidth * progress;
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
      ${input.backgroundSource ? `<rect width="100%" height="100%" fill="#000000" fill-opacity="0.34"/>` : ""}
      <rect x="${trackX}" y="${trackY}" width="${trackWidth}" height="${trackHeight}" rx="${trackHeight / 2}" fill="#FFFFFF" fill-opacity="0.30"/>
      ${fillWidth > 0 ? `<rect x="${trackX}" y="${trackY}" width="${fillWidth}" height="${trackHeight}" rx="${trackHeight / 2}" fill="${foreground}"/>` : ""}
    </svg>`,
  );
  const base = input.backgroundSource
    ? sharp(await renderAppleWalletPositionedImage(
      input.backgroundSource,
      size.width,
      size.height,
      input.backgroundLayout ?? DEFAULT_APPLE_WALLET_IMAGE_LAYOUT,
      { fit: "cover", background },
    ))
    : sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background,
      },
    });
  return base.composite([{ input: overlay }]).png().toBuffer();
}

export async function buildAppleWalletPointStrips(input: PointStripInput) {
  if (!input.nextGoal || input.nextGoal <= 0) {
    return {} as Record<string, Buffer>;
  }
  const rendered = await Promise.all(
    stripSizes.map(async (size) => [size.name, await renderPointStrip(input, size)] as const),
  );
  return Object.fromEntries(rendered) as Record<string, Buffer>;
}
