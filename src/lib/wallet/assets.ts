export const APPLE_WALLET_ASSET_BUCKET = "wallet-assets";
export const APPLE_WALLET_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const APPLE_WALLET_ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AppleWalletAssetKind = "logo" | "strip";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export function validateAppleWalletAssetFile(file: {
  size: number;
  type: string;
}) {
  if (
    !APPLE_WALLET_ASSET_MIME_TYPES.includes(
      file.type as (typeof APPLE_WALLET_ASSET_MIME_TYPES)[number],
    )
  ) {
    return "Selecciona una imagen PNG, JPEG o WebP.";
  }
  if (file.size <= 0 || file.size > APPLE_WALLET_ASSET_MAX_BYTES) {
    return "La imagen debe pesar como máximo 5 MB.";
  }
  return null;
}

export function createAppleWalletAssetPath(
  tenantId: string,
  kind: AppleWalletAssetKind,
  mimeType: (typeof APPLE_WALLET_ASSET_MIME_TYPES)[number],
  objectId = crypto.randomUUID(),
) {
  if (!UUID.test(tenantId) || !UUID.test(objectId)) {
    throw new Error("Invalid Apple Wallet asset identifier.");
  }
  return `${tenantId}/apple/${kind}-${objectId}.${EXTENSION_BY_MIME[mimeType]}`;
}

export function appleWalletAssetPathFromPublicUrl(
  value: string,
  supabaseUrl: string,
) {
  try {
    const candidate = new URL(value);
    const project = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${APPLE_WALLET_ASSET_BUCKET}/`;
    if (
      candidate.origin !== project.origin ||
      candidate.username ||
      candidate.password ||
      candidate.search ||
      candidate.hash ||
      !candidate.pathname.startsWith(prefix)
    ) {
      return null;
    }
    const path = candidate.pathname
      .slice(prefix.length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
    if (!path || path.includes("..") || path.startsWith("/")) return null;
    return path;
  } catch {
    return null;
  }
}

export function tenantAppleWalletAssetPath(
  value: string,
  supabaseUrl: string,
  tenantId: string,
  kind: AppleWalletAssetKind,
) {
  const path = appleWalletAssetPathFromPublicUrl(value, supabaseUrl);
  if (!path || !UUID.test(tenantId)) return null;
  const escapedTenant = tenantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^${escapedTenant}/apple/${kind}-[0-9a-f-]{36}\\.(?:png|jpg|webp)$`,
    "i",
  );
  return pattern.test(path) ? path : null;
}
