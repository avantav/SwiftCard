import { NextRequest, NextResponse } from "next/server";
import {
  applePassRequestIsAuthorized,
  getAppleWalletPassRecord,
  registerAppleWalletDevice,
  unregisterAppleWalletDevice,
  validAppleDeviceIdentifier,
  validApplePassTypeIdentifier,
  validApplePushToken,
  validAppleSerialNumber,
} from "@/lib/wallet/apple-web-service";
import { walletProviderConfig } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
};

function empty(status: number) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorizedParameters(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  if (
    !walletProviderConfig("APPLE").configured ||
    !validApplePassTypeIdentifier(params.passTypeIdentifier) ||
    !validAppleSerialNumber(params.serialNumber) ||
    !validAppleDeviceIdentifier(params.deviceLibraryIdentifier)
  ) {
    return null;
  }
  const pass = await getAppleWalletPassRecord(params.serialNumber);
  if (
    !pass ||
    !applePassRequestIsAuthorized(
      params.serialNumber,
      request.headers.get("authorization"),
    )
  ) {
    return null;
  }
  return params;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await authorizedParameters(request, context);
  if (!params) return empty(401);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 4096) return empty(400);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 4096) return empty(400);

  let pushToken = "";
  try {
    const body = JSON.parse(rawBody) as { pushToken?: unknown };
    pushToken = typeof body.pushToken === "string" ? body.pushToken : "";
  } catch {
    return empty(400);
  }
  if (!validApplePushToken(pushToken)) return empty(400);

  try {
    const result = await registerAppleWalletDevice({
      serialNumber: params.serialNumber,
      deviceLibraryIdentifier: params.deviceLibraryIdentifier,
      pushToken,
    });
    if (result === "CREATED") return empty(201);
    if (result === "UPDATED") return empty(200);
    return empty(result === "INVALID" ? 400 : 404);
  } catch {
    return empty(500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await authorizedParameters(request, context);
  if (!params) return empty(401);
  try {
    await unregisterAppleWalletDevice({
      serialNumber: params.serialNumber,
      deviceLibraryIdentifier: params.deviceLibraryIdentifier,
    });
    return empty(200);
  } catch {
    return empty(500);
  }
}
