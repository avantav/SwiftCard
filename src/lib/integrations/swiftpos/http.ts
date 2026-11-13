import "server-only";

import { NextResponse } from "next/server";
import { ERROR_STATUS, type ApiErrorCode } from "./requests";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

export const MAX_BODY_BYTES = 8 * 1024;

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export function apiError(code: ApiErrorCode) {
  return apiJson({ error: code }, ERROR_STATUS[code]);
}

/** Reads a JSON body of at most MAX_BODY_BYTES; null when absent, too large or invalid. */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return null;
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Logs without keys, QR contents, tickets or personal data. */
export function logIntegrationError(route: string, error: unknown) {
  console.error("[swiftpos-integration]", {
    route,
    message: error instanceof Error ? error.message.slice(0, 200) : "Unknown error"
  });
}
