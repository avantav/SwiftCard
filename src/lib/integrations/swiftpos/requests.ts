/**
 * Request validation and stable error codes for the SwiftPOS API
 * (docs/SWIFTPOS_INTEGRATION.md). The database re-validates everything.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "MODULE_NOT_ACTIVE"
  | "BRANCH_NOT_LINKED"
  | "CARD_NOT_FOUND"
  | "PROGRAM_PAUSED"
  | "SCAN_TICKET_INVALID"
  | "SCAN_TICKET_EXPIRED"
  | "SCAN_TICKET_MISMATCH"
  | "INVALID_REQUEST"
  | "LIMIT_EXCEEDED"
  | "OUTSIDE_GEOFENCE"
  | "DUPLICATE_TICKET"
  | "IDEMPOTENCY_CONFLICT"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "SERVICE_UNAVAILABLE";

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  MODULE_NOT_ACTIVE: 403,
  BRANCH_NOT_LINKED: 422,
  CARD_NOT_FOUND: 404,
  PROGRAM_PAUSED: 409,
  SCAN_TICKET_INVALID: 422,
  SCAN_TICKET_EXPIRED: 422,
  SCAN_TICKET_MISMATCH: 422,
  INVALID_REQUEST: 400,
  LIMIT_EXCEEDED: 422,
  OUTSIDE_GEOFENCE: 422,
  DUPLICATE_TICKET: 409,
  IDEMPOTENCY_CONFLICT: 409,
  UNAVAILABLE: 409,
  NOT_CONFIGURED: 503,
  SERVICE_UNAVAILABLE: 503
};

/** Database results that are not successes, mapped to API error codes. */
export function errorFromDatabaseResult(result: unknown): ApiErrorCode {
  switch (result) {
    case "UNAUTHORIZED":
    case "RATE_LIMITED":
    case "MODULE_NOT_ACTIVE":
    case "BRANCH_NOT_LINKED":
    case "CARD_NOT_FOUND":
    case "PROGRAM_PAUSED":
    case "SCAN_TICKET_MISMATCH":
    case "LIMIT_EXCEEDED":
    case "OUTSIDE_GEOFENCE":
    case "DUPLICATE_TICKET":
    case "IDEMPOTENCY_CONFLICT":
    case "UNAVAILABLE":
      return result;
    case "INVALID":
      return "INVALID_REQUEST";
    default:
      return "SERVICE_UNAVAILABLE";
  }
}

type Result<T> = { ok: true; data: T } | { ok: false };

const STORE_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;
const SALE_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
}

export function parseResolveRequest(body: unknown): Result<{ storeId: string; scan: string }> {
  if (!isObject(body)) return { ok: false };
  const storeId = typeof body.storeId === "string" && STORE_PATTERN.test(body.storeId) ? body.storeId : null;
  const scan = trimmedString(body.scan, 2048);
  return storeId && scan ? { ok: true, data: { storeId, scan } } : { ok: false };
}

export type PurchaseRequest = {
  storeId: string;
  scanTicket: string;
  externalSaleId: string;
  ticketNumber: string;
  amountMinor: number;
  occurredAt: string;
  cashier: { id: string; name: string };
  location: { latitude: number; longitude: number } | null;
};

export function parsePurchaseRequest(body: unknown): Result<PurchaseRequest> {
  if (!isObject(body)) return { ok: false };
  const storeId = typeof body.storeId === "string" && STORE_PATTERN.test(body.storeId) ? body.storeId : null;
  const scanTicket = typeof body.scanTicket === "string" && body.scanTicket.length <= 600 ? body.scanTicket : null;
  const externalSaleId = typeof body.externalSaleId === "string" && SALE_PATTERN.test(body.externalSaleId) ? body.externalSaleId : null;
  const ticketNumber = trimmedString(body.ticketNumber, 60);
  const amountMinor = typeof body.amountMinor === "number" && Number.isSafeInteger(body.amountMinor) && body.amountMinor > 0
    ? body.amountMinor
    : null;
  const occurredAt = typeof body.occurredAt === "string" && body.occurredAt.length <= 40 && !Number.isNaN(Date.parse(body.occurredAt))
    ? new Date(body.occurredAt).toISOString()
    : null;
  const cashier = isObject(body.cashier)
    ? { id: trimmedString(body.cashier.id, 100), name: trimmedString(body.cashier.name, 120) }
    : null;

  let location: PurchaseRequest["location"] = null;
  if (body.location !== undefined && body.location !== null) {
    if (!isObject(body.location)) return { ok: false };
    const { latitude, longitude } = body.location;
    if (
      typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return { ok: false };
    }
    location = { latitude, longitude };
  }

  if (!storeId || !scanTicket || !externalSaleId || !ticketNumber || !amountMinor || !occurredAt || !cashier?.id || !cashier.name) {
    return { ok: false };
  }
  return {
    ok: true,
    data: { storeId, scanTicket, externalSaleId, ticketNumber, amountMinor, occurredAt, cashier: { id: cashier.id, name: cashier.name }, location }
  };
}
