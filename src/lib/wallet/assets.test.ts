import { describe, expect, it } from "vitest";
import {
  APPLE_WALLET_ASSET_MAX_BYTES,
  appleWalletAssetPathFromPublicUrl,
  createAppleWalletAssetPath,
  tenantAppleWalletAssetPath,
  validateAppleWalletAssetFile,
} from "./assets";

const tenantId = "10000000-0000-4000-8000-000000000001";
const objectId = "20000000-0000-4000-8000-000000000002";
const supabaseUrl = "https://project.supabase.co";

describe("Apple Wallet Storage assets", () => {
  it("builds a tenant-scoped object path from an allowed MIME type", () => {
    expect(
      createAppleWalletAssetPath(tenantId, "logo", "image/jpeg", objectId),
    ).toBe(`${tenantId}/apple/logo-${objectId}.jpg`);
    expect(
      createAppleWalletAssetPath(
        "10000000-0000-0000-0000-000000000001",
        "strip",
        "image/png",
        objectId,
      ),
    ).toContain("/apple/strip-");
  });

  it("accepts only bounded Wallet image formats", () => {
    expect(validateAppleWalletAssetFile({ size: 1024, type: "image/png" })).toBeNull();
    expect(
      validateAppleWalletAssetFile({ size: 1024, type: "image/svg+xml" }),
    ).toContain("PNG");
    expect(
      validateAppleWalletAssetFile({
        size: APPLE_WALLET_ASSET_MAX_BYTES + 1,
        type: "image/webp",
      }),
    ).toContain("5 MB");
  });

  it("parses only public URLs from the configured Supabase project", () => {
    const path = `${tenantId}/apple/strip-${objectId}.webp`;
    const url = `${supabaseUrl}/storage/v1/object/public/wallet-assets/${path}`;
    expect(appleWalletAssetPathFromPublicUrl(url, supabaseUrl)).toBe(path);
    expect(tenantAppleWalletAssetPath(url, supabaseUrl, tenantId, "strip")).toBe(path);
    expect(tenantAppleWalletAssetPath(url, supabaseUrl, tenantId, "logo")).toBeNull();
    expect(
      appleWalletAssetPathFromPublicUrl(
        `https://attacker.example/storage/v1/object/public/wallet-assets/${path}`,
        supabaseUrl,
      ),
    ).toBeNull();
  });
});
