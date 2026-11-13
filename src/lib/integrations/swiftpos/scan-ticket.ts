import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that a card was physically scanned (hardening H3). `/cards/resolve`
 * returns it and `/purchases` requires it, so a leaked API key cannot accrue
 * on arbitrary cards. It binds card, integration and branch and lasts 72 h,
 * the same window accepted for a sale's `occurredAt`.
 */
export const SCAN_TICKET_TTL_MS = 72 * 60 * 60 * 1000;

export type ScanTicketClaims = {
  customerCardId: string;
  integrationId: string;
  branchId: string;
  expiresAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 32-byte base64 secret from SWIFTPOS_SCAN_TICKET_SECRET, or null if missing/invalid. */
export function scanTicketSecret(value = process.env.SWIFTPOS_SCAN_TICKET_SECRET): Buffer | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const secret = Buffer.from(trimmed, "base64");
  return secret.length === 32 ? secret : null;
}

function signature(payload: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(`swiftpos-scan-ticket:v1:${payload}`).digest("base64url");
}

export function signScanTicket(
  claims: Omit<ScanTicketClaims, "expiresAt">,
  secret: Buffer,
  now = Date.now()
): string {
  const payload = Buffer.from(JSON.stringify({
    c: claims.customerCardId,
    i: claims.integrationId,
    b: claims.branchId,
    e: now + SCAN_TICKET_TTL_MS
  })).toString("base64url");
  return `v1.${payload}.${signature(payload, secret)}`;
}

export function verifyScanTicket(
  token: unknown,
  secret: Buffer,
  now = Date.now()
): { ok: true; claims: ScanTicketClaims } | { ok: false; reason: "INVALID" | "EXPIRED" } {
  if (typeof token !== "string" || token.length > 600) return { ok: false, reason: "INVALID" };
  const [version, payload, provided, extra] = token.split(".");
  if (version !== "v1" || !payload || !provided || extra !== undefined) return { ok: false, reason: "INVALID" };
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, reason: "INVALID" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "INVALID" };
  }
  const data = parsed as { c?: unknown; i?: unknown; b?: unknown; e?: unknown };
  if (
    typeof data.c !== "string" || !UUID_PATTERN.test(data.c)
    || typeof data.i !== "string" || !UUID_PATTERN.test(data.i)
    || typeof data.b !== "string" || !UUID_PATTERN.test(data.b)
    || typeof data.e !== "number" || !Number.isFinite(data.e)
  ) {
    return { ok: false, reason: "INVALID" };
  }
  if (data.e <= now) return { ok: false, reason: "EXPIRED" };
  return { ok: true, claims: { customerCardId: data.c, integrationId: data.i, branchId: data.b, expiresAt: data.e } };
}
