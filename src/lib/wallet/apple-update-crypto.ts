import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const UPDATE_SECRET_BYTES = 32;
const PUSH_TOKEN_VERSION = "v1";

function deriveKey(secret: Buffer, purpose: string) {
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      Buffer.from("swiftwallet-apple-wallet-v1", "utf8"),
      Buffer.from(purpose, "utf8"),
      32,
    ),
  );
}

function keyedHash(secret: Buffer, purpose: string, value: string) {
  return createHmac("sha256", deriveKey(secret, purpose))
    .update(value, "utf8")
    .digest("hex");
}

export function decodeAppleWalletUpdateSecret(raw: string | undefined) {
  if (!raw?.trim()) {
    throw new Error("Missing APPLE_WALLET_UPDATE_SECRET_BASE64.");
  }
  const normalized = raw.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("Invalid APPLE_WALLET_UPDATE_SECRET_BASE64.");
  }
  const secret = Buffer.from(normalized, "base64");
  if (secret.length !== UPDATE_SECRET_BYTES) {
    throw new Error("APPLE_WALLET_UPDATE_SECRET_BASE64 must decode to 32 bytes.");
  }
  return secret;
}

export function applePassAuthenticationToken(secret: Buffer, serialNumber: string) {
  if (!serialNumber.trim()) throw new Error("Apple Wallet serial number is required.");
  return createHmac("sha256", deriveKey(secret, "pass-authentication"))
    .update(`pass:${serialNumber}`, "utf8")
    .digest("base64url");
}

export function appleDeviceIdentifierHash(secret: Buffer, identifier: string) {
  if (!identifier.trim()) throw new Error("Apple Wallet device identifier is required.");
  return keyedHash(secret, "device-library-identifier", identifier);
}

export function applePushTokenHash(secret: Buffer, pushToken: string) {
  if (!pushToken.trim()) throw new Error("Apple Wallet push token is required.");
  return keyedHash(secret, "push-token-hash", pushToken);
}

export function encryptApplePushToken(secret: Buffer, pushToken: string) {
  if (!pushToken.trim()) throw new Error("Apple Wallet push token is required.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "push-token-encryption"), iv);
  cipher.setAAD(Buffer.from(PUSH_TOKEN_VERSION, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(pushToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PUSH_TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptApplePushToken(secret: Buffer, ciphertext: string) {
  const [version, encodedIv, encodedTag, encodedValue, ...extra] = ciphertext.split(".");
  if (
    version !== PUSH_TOKEN_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedValue ||
    extra.length
  ) {
    throw new Error("Invalid encrypted Apple Wallet push token.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const encrypted = Buffer.from(encodedValue, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) {
    throw new Error("Invalid encrypted Apple Wallet push token.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret, "push-token-encryption"),
    iv,
  );
  decipher.setAAD(Buffer.from(PUSH_TOKEN_VERSION, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function applePassAuthorizationMatches(
  authorizationHeader: string | null,
  expectedToken: string,
) {
  const prefix = "ApplePass ";
  if (!authorizationHeader?.startsWith(prefix)) return false;
  const supplied = Buffer.from(authorizationHeader.slice(prefix.length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function bearerSecretMatches(
  authorizationHeader: string | null,
  expectedSecret: string,
) {
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return false;
  const supplied = Buffer.from(authorizationHeader.slice(prefix.length), "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
