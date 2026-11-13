import { createHash } from "node:crypto";

/** Owner password recovery (DEC-0063): pure helpers shared by actions and tests. */

export const RECOVERY_PATH = "/recuperar-contrasena";
export const RECOVERY_NEW_PASSWORD_PATH = "/recuperar-contrasena/nueva";

/** Supabase recovery token hashes are hex; anything else is rejected early. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

export function normalizeRecoveryEmail(value: FormDataEntryValue | null) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : null;
}

export function isRecoveryToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** First address of X-Forwarded-For (set by the hosting proxy), else X-Real-IP. */
export function clientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function recoveryLink(origin: string, tokenHash: string) {
  const url = new URL(RECOVERY_NEW_PASSWORD_PATH, origin);
  url.searchParams.set("token", tokenHash);
  return url.toString();
}
