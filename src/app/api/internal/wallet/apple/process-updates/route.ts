import { NextRequest, NextResponse } from "next/server";
import { dispatchPendingAppleWalletUpdates } from "@/lib/wallet/apple-apns";
import { bearerSecretMatches } from "@/lib/wallet/apple-update-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const retrySecret = process.env.APPLE_WALLET_RETRY_SECRET?.trim();
  if (
    !retrySecret ||
    retrySecret.length < 32 ||
    !bearerSecretMatches(request.headers.get("authorization"), retrySecret)
  ) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await dispatchPendingAppleWalletUpdates({ limit: 25 });
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron procesar las actualizaciones pendientes." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
