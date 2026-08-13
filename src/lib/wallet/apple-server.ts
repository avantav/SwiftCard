import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { buildAppleWalletStampStrips } from "./apple-stamp-strip";
import type { AppleWalletPassData } from "./apple";
import { buildAppleWalletPassProps } from "./apple";
import { walletProviderConfig } from "./service";
import { resolvePublicOrigin } from "@/lib/public-origin";
import {
  applePassAuthenticationToken,
  decodeAppleWalletUpdateSecret,
} from "./apple-update-crypto";

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;

function decodePemSecret(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`Missing ${name}.`);
  if (raw.includes("-----BEGIN")) return Buffer.from(raw.replaceAll("\\n", "\n"));
  const decoded = Buffer.from(raw, "base64");
  if (!decoded.toString("utf8").includes("-----BEGIN")) {
    throw new Error(`Invalid ${name}.`);
  }
  return decoded;
}

export function getAppleSigningConfig() {
  const status = walletProviderConfig("APPLE");
  if (!status.configured) throw new Error("Apple Wallet signing is not configured.");
  return {
    identity: {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!.trim(),
      teamIdentifier: process.env.APPLE_TEAM_ID!.trim(),
    },
    certificates: {
      signerCert: decodePemSecret("APPLE_SIGNER_CERTIFICATE_BASE64"),
      signerKey: decodePemSecret("APPLE_SIGNER_KEY_BASE64"),
      wwdr: decodePemSecret("APPLE_WWDR_CERTIFICATE_BASE64"),
      signerKeyPassphrase: process.env.APPLE_CERTIFICATE_PASSWORD?.trim() || undefined,
    },
  };
}

export function getAppleWalletUpdateSecret() {
  return decodeAppleWalletUpdateSecret(
    process.env.APPLE_WALLET_UPDATE_SECRET_BASE64,
  );
}

export function getApplePassAuthenticationToken(serialNumber: string) {
  return applePassAuthenticationToken(getAppleWalletUpdateSecret(), serialNumber);
}

function allowedAssetHosts() {
  const hosts = new Set(
    (process.env.APPLE_WALLET_ASSET_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) hosts.add(new URL(supabaseUrl).hostname.toLowerCase());
  } catch {
    // An invalid public Supabase URL is handled by the Supabase config boundary.
  }
  return hosts;
}

async function fetchAllowedImage(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !allowedAssetHosts().has(parsed.hostname.toLowerCase())
    ) {
      return null;
    }

    const response = await fetch(parsed, {
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "image/png,image/jpeg,image/webp" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";", 1)[0];
    if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REMOTE_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) return null;
    const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height) return null;
    return buffer;
  } catch {
    return null;
  }
}

async function resizedPng(
  source: Buffer,
  width: number,
  height: number,
  fit: "contain" | "cover",
) {
  return sharp(source, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(width, height, {
      fit,
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function buildPassImages(
  input: AppleWalletPassData,
  logoUrl: string | null,
  stripUrl: string | null,
) {
  const fallback = await readFile(
    join(process.cwd(), "public", "icons", "apple-touch-icon.png"),
  );
  const tenantLogoSource = await fetchAllowedImage(logoUrl);
  const logoSource = tenantLogoSource ?? fallback;
  const stripSource = await fetchAllowedImage(stripUrl);
  const entries = await Promise.all([
    resizedPng(logoSource, 29, 29, "contain"),
    resizedPng(logoSource, 58, 58, "contain"),
    resizedPng(logoSource, 87, 87, "contain"),
    resizedPng(logoSource, 160, 50, "contain"),
    resizedPng(logoSource, 320, 100, "contain"),
    resizedPng(logoSource, 480, 150, "contain"),
  ]);
  const images: Record<string, Buffer> = {
    "icon.png": entries[0],
    "icon@2x.png": entries[1],
    "icon@3x.png": entries[2],
    "logo.png": entries[3],
    "logo@2x.png": entries[4],
    "logo@3x.png": entries[5],
  };
  const stampStrips = input.programType === "LIFETIME_POINTS"
    ? {}
    : await buildAppleWalletStampStrips({
      backgroundColor: input.backgroundColor,
      foregroundColor: input.foregroundColor,
      stampBalance: input.stampBalance,
      rewardGoal: input.rewardGoal,
      tenantName: input.tenantName,
      logoSource: tenantLogoSource,
      backgroundSource: stripSource,
    });
  if (Object.keys(stampStrips).length) {
    Object.assign(images, stampStrips);
  } else if (stripSource) {
    const staticStrips = await Promise.all([
      resizedPng(stripSource, 375, 144, "cover"),
      resizedPng(stripSource, 750, 288, "cover"),
      resizedPng(stripSource, 1125, 432, "cover"),
    ]);
    images["strip.png"] = staticStrips[0];
    images["strip@2x.png"] = staticStrips[1];
    images["strip@3x.png"] = staticStrips[2];
  }
  return images;
}

export async function generateAppleWalletPass(
  input: AppleWalletPassData,
  assets: { logoUrl: string | null; stripUrl: string | null },
) {
  const signing = getAppleSigningConfig();
  const images = await buildPassImages(input, assets.logoUrl, assets.stripUrl);
  const { barcodes, locations, storeCard, ...props } =
    buildAppleWalletPassProps(input, signing.identity);
  const pass = new PKPass(
    images,
    signing.certificates,
    props,
  );
  pass.type = "storeCard";
  pass.setBarcodes(...barcodes);
  if (locations.length) pass.setLocations(...locations);
  pass.headerFields.push(...storeCard.headerFields);
  pass.primaryFields.push(...storeCard.primaryFields);
  pass.secondaryFields.push(...storeCard.secondaryFields);
  pass.auxiliaryFields.push(...storeCard.auxiliaryFields);
  pass.backFields.push(...storeCard.backFields);
  return pass.getAsBuffer();
}

export function resolvePublicAppUrl(requestUrl: string) {
  const configured = process.env.SWIFTWALLET_PUBLIC_URL?.trim();
  const origin = resolvePublicOrigin(configured || new URL(requestUrl).origin);
  if (!origin) {
    throw new Error("SwiftWallet public URL must use HTTPS.");
  }
  return origin;
}
