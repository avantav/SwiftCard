import sharp from "sharp";

export const APPLE_WALLET_MAX_VISIBLE_STAMPS = 24;

const stripSizes = [
  { name: "strip.png", width: 375, height: 144 },
  { name: "strip@2x.png", width: 750, height: 288 },
  { name: "strip@3x.png", width: 1125, height: 432 },
] as const;

type StampStripInput = {
  backgroundColor: string;
  foregroundColor: string;
  stampBalance: number;
  rewardGoal: number | null;
  tenantName: string;
  logoSource: Buffer | null;
  backgroundSource: Buffer | null;
};

function safeHex(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function appleWalletStampSlots(stampBalance: number, rewardGoal: number | null) {
  const goal = Math.max(0, Math.trunc(rewardGoal ?? 0));
  if (!goal) return { goal: 0, earned: 0, visible: 0, filled: 0 };
  const earned = Math.min(goal, Math.max(0, Math.trunc(stampBalance)));
  const visible = Math.min(goal, APPLE_WALLET_MAX_VISIBLE_STAMPS);
  const proportional = Math.round((earned / goal) * visible);
  const filled = goal <= APPLE_WALLET_MAX_VISIBLE_STAMPS
    ? earned
    : earned === 0
      ? 0
      : earned >= goal
        ? visible
        : Math.min(visible - 1, Math.max(1, proportional));
  return { goal, earned, visible, filled };
}

function stampLayout(visible: number) {
  if (visible <= 5) return { columns: visible, diameter: 54, gap: 14 };
  if (visible <= 10) return { columns: 5, diameter: 46, gap: 14 };
  if (visible <= 16) return { columns: 8, diameter: 34, gap: 10 };
  return { columns: 8, diameter: 32, gap: 10 };
}

async function renderStampStrip(
  input: StampStripInput,
  size: (typeof stripSizes)[number],
) {
  const scale = size.width / 375;
  const progress = appleWalletStampSlots(input.stampBalance, input.rewardGoal);
  const layout = stampLayout(progress.visible);
  const rows = Math.ceil(progress.visible / layout.columns);
  const diameter = layout.diameter * scale;
  const gap = layout.gap * scale;
  const gridHeight = rows * diameter + (rows - 1) * gap;
  const startY = (size.height - gridHeight) / 2;
  const foreground = safeHex(input.foregroundColor, "#FFFFFF");
  const background = safeHex(input.backgroundColor, "#17202A");
  const initials = escapeXml(
    input.tenantName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SW",
  );

  const slots = Array.from({ length: progress.visible }, (_, index) => {
    const row = Math.floor(index / layout.columns);
    const rowCount = Math.min(
      layout.columns,
      progress.visible - row * layout.columns,
    );
    const rowWidth = rowCount * diameter + (rowCount - 1) * gap;
    const x = (size.width - rowWidth) / 2 + (index % layout.columns) * (diameter + gap);
    const y = startY + row * (diameter + gap);
    const cx = x + diameter / 2;
    const cy = y + diameter / 2;
    const filled = index < progress.filled;
    return {
      x,
      y,
      filled,
      svg: filled
        ? `<circle cx="${cx}" cy="${cy}" r="${diameter / 2 - scale}" fill="${foreground}" stroke="#FFFFFF" stroke-width="${2 * scale}"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${diameter / 2 - 2 * scale}" fill="#FFFFFF" fill-opacity="0.16" stroke="${foreground}" stroke-width="${2 * scale}" stroke-dasharray="${3 * scale} ${3 * scale}"/>`,
    };
  });

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
      ${input.backgroundSource ? `<rect width="100%" height="100%" fill="#000000" fill-opacity="0.30"/>` : ""}
      ${slots.map((slot) => slot.svg).join("")}
      ${input.logoSource ? "" : slots.filter((slot) => slot.filled).map((slot) => {
        const x = slot.x + diameter / 2;
        const y = slot.y + diameter / 2 + 4 * scale;
        return `<text x="${x}" y="${y}" fill="${background}" font-family="Arial, sans-serif" font-size="${Math.max(10, diameter * 0.28)}" font-weight="700" text-anchor="middle">${initials}</text>`;
      }).join("")}
    </svg>`,
  );

  const base = input.backgroundSource
    ? sharp(input.backgroundSource, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(size.width, size.height, { fit: "cover", position: "centre" })
    : sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background,
      },
    });
  const composites: Array<{ input: Buffer; left?: number; top?: number }> = [
    { input: overlay },
  ];

  if (input.logoSource) {
    const innerSize = Math.round(diameter - 10 * scale);
    const logo = await sharp(input.logoSource, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(innerSize, innerSize, {
        fit: "contain",
        position: "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${innerSize}" height="${innerSize}"><circle cx="${innerSize / 2}" cy="${innerSize / 2}" r="${innerSize / 2}" fill="#FFFFFF"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
    for (const slot of slots.filter((candidate) => candidate.filled)) {
      composites.push({
        input: logo,
        left: Math.round(slot.x + (diameter - innerSize) / 2),
        top: Math.round(slot.y + (diameter - innerSize) / 2),
      });
    }
  }

  return base.composite(composites).png().toBuffer();
}

export async function buildAppleWalletStampStrips(input: StampStripInput) {
  const progress = appleWalletStampSlots(input.stampBalance, input.rewardGoal);
  if (!progress.visible) return {} as Record<string, Buffer>;
  const rendered = await Promise.all(
    stripSizes.map(async (size) => [size.name, await renderStampStrip(input, size)] as const),
  );
  return Object.fromEntries(rendered) as Record<string, Buffer>;
}
