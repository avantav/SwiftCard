import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAppleWalletPassSource } from "@/lib/wallet/apple-pass-source";
import { generateAppleWalletPass } from "@/lib/wallet/apple-server";
import {
  applePassRequestIsAuthorized,
  getAppleWalletPassRecord,
  validApplePassTypeIdentifier,
  validAppleSerialNumber,
} from "@/lib/wallet/apple-web-service";
import { walletProviderConfig } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
};

function empty(status: number) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseIfModifiedSince(request: NextRequest) {
  const raw = request.headers.get("if-modified-since");
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  if (
    !walletProviderConfig("APPLE").configured ||
    !validApplePassTypeIdentifier(params.passTypeIdentifier) ||
    !validAppleSerialNumber(params.serialNumber)
  ) {
    return empty(404);
  }
  const passRecord = await getAppleWalletPassRecord(params.serialNumber);
  if (
    !passRecord ||
    !applePassRequestIsAuthorized(
      params.serialNumber,
      request.headers.get("authorization"),
    )
  ) {
    return empty(401);
  }

  const ifModifiedSince = parseIfModifiedSince(request);
  const lastSyncedAt = passRecord.last_synced_at
    ? Date.parse(passRecord.last_synced_at)
    : null;
  if (
    ifModifiedSince !== null &&
    lastSyncedAt !== null &&
    passRecord.status === "ACTIVE" &&
    !passRecord.update_pending_at &&
    Math.floor(ifModifiedSince / 1000) >= Math.floor(lastSyncedAt / 1000)
  ) {
    return empty(304);
  }

  const loaded = await loadAppleWalletPassSource(
    { serialNumber: params.serialNumber, allowInactive: true },
    request.url,
  );
  if (!loaded.ok) return empty(loaded.status);
  const { source } = loaded;
  const responseModifiedAt = source.lastModified ?? new Date();
  const supabase = createSupabaseAdminClient();

  try {
    const pass = await generateAppleWalletPass(source.passData, source.assets);
    const { error: syncError } = await supabase
      .from("wallet_passes")
      .update({
        status: "ACTIVE",
        last_synced_at: new Date().toISOString(),
        update_pending_at: null,
        last_error: null,
      })
      .eq("id", passRecord.id)
      .eq("update_tag", passRecord.update_tag);
    if (syncError) throw syncError;
    return new NextResponse(new Uint8Array(pass), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, must-revalidate",
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": responseModifiedAt.toUTCString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    await supabase
      .from("wallet_passes")
      .update({
        status: "FAILED",
        last_error: "Apple Wallet update generation failed.",
      })
      .eq("id", passRecord.id)
      .eq("update_tag", passRecord.update_tag);
    return empty(500);
  }
}
