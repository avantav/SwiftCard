import { NextRequest, NextResponse } from "next/server";
import { sanitizeAppleWalletLog } from "@/lib/wallet/apple-web-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 16_384) return new NextResponse(null, { status: 400 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 16_384) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const body = JSON.parse(rawBody) as { logs?: unknown };
    if (
      !Array.isArray(body.logs) ||
      body.logs.length > 20 ||
      body.logs.some((entry) => typeof entry !== "string")
    ) {
      return new NextResponse(null, { status: 400 });
    }
    console.warn("[apple-wallet-device-log]", {
      entries: body.logs.map((entry) => sanitizeAppleWalletLog(entry as string)),
    });
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
