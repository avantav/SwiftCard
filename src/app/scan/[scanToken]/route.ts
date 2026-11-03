import { NextResponse } from "next/server";
import { resolvePublicRequestOrigin } from "@/lib/public-origin";
import { getCardRegistrationPath, openPublicCardScanToken } from "@/lib/customers/card-scan-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ scanToken: string }> }) {
  const { scanToken } = await params;
  const cardToken = openPublicCardScanToken(scanToken);
  const path = cardToken ? await getCardRegistrationPath(cardToken) : null;
  const response = path
    ? NextResponse.redirect(new URL(path, resolvePublicRequestOrigin(request.url, request.headers)), 303)
    : new NextResponse("Este código no está disponible.", { status: 404 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
