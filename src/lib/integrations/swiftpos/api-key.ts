import { createHash, randomBytes } from "node:crypto";

/**
 * SwiftPOS API keys: `sc_live_<prefix>_<secret>`. The prefix (8 lowercase
 * alphanumerics) identifies the key in the Superadmin; the secret has 32
 * random bytes. Only the SHA-256 of the whole key is stored (DEC-0071).
 */
const KEY_PATTERN = /^sc_live_([a-z0-9]{8})_([A-Za-z0-9_-]{43})$/;
const PREFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefixBytes = randomBytes(8);
  const prefix = Array.from(prefixBytes, (byte) => PREFIX_ALPHABET[byte % PREFIX_ALPHABET.length]).join("");
  const secret = randomBytes(32).toString("base64url");
  const key = `sc_live_${prefix}_${secret}`;
  return { key, prefix, hash: hashApiKey(key) };
}

/** Returns the key hash from an `Authorization: Bearer <key>` header, or null. */
export function apiKeyHashFromHeader(header: string | null): string | null {
  if (!header || header.length > 200) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header.trim());
  if (!match || !KEY_PATTERN.test(match[1])) return null;
  return hashApiKey(match[1]);
}
