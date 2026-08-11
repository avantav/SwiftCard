import { NextRequest, NextResponse } from "next/server";
import {
  listAppleWalletUpdates,
  parseAppleUpdateTag,
  validAppleDeviceIdentifier,
  validApplePassTypeIdentifier,
} from "@/lib/wallet/apple-web-service";
import { walletProviderConfig } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  if (
    !walletProviderConfig("APPLE").configured ||
    !validApplePassTypeIdentifier(params.passTypeIdentifier) ||
    !validAppleDeviceIdentifier(params.deviceLibraryIdentifier)
  ) {
    return new NextResponse(null, { status: 404 });
  }
  const previousUpdateTag = parseAppleUpdateTag(
    request.nextUrl.searchParams.get("passesUpdatedSince"),
  );
  if (previousUpdateTag === undefined) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const updates = await listAppleWalletUpdates({
      deviceLibraryIdentifier: params.deviceLibraryIdentifier,
      previousUpdateTag,
    });
    if (!updates.length) {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const lastUpdated = updates.reduce(
      (latest, update) =>
        BigInt(update.update_tag) > BigInt(latest) ? update.update_tag : latest,
      "0",
    );
    return NextResponse.json(
      {
        serialNumbers: updates.map((update) => update.serial_number),
        lastUpdated,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
