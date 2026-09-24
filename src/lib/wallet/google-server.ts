import "server-only";

import { createSign } from "node:crypto";
import {
  buildGoogleWalletResources,
  type GoogleWalletPassData,
} from "./google";

const GOOGLE_WALLET_API =
  "https://walletobjects.googleapis.com/walletobjects/v1";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_WALLET_SCOPE =
  "https://www.googleapis.com/auth/wallet_object.issuer";

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

type CachedAccessToken = {
  accessToken: string;
  expiresAt: number;
  serviceAccountEmail: string;
};

let cachedAccessToken: CachedAccessToken | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, privateKey: string) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

export function parseGoogleWalletServiceAccount(
  rawValue = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT,
): GoogleServiceAccount {
  const raw = rawValue?.trim();
  if (!raw) throw new Error("Google Wallet service account is not configured.");

  let parsed: unknown;
  try {
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Google Wallet service account is invalid.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("client_email" in parsed) ||
    !("private_key" in parsed) ||
    typeof parsed.client_email !== "string" ||
    typeof parsed.private_key !== "string" ||
    !parsed.client_email.includes("@") ||
    !parsed.private_key.includes("PRIVATE KEY")
  ) {
    throw new Error("Google Wallet service account is invalid.");
  }

  return {
    client_email: parsed.client_email.trim(),
    private_key: parsed.private_key.replaceAll("\\n", "\n").trim(),
  };
}

function configuredIssuerId() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  if (!issuerId || !/^\d{6,32}$/.test(issuerId)) {
    throw new Error("Google Wallet issuer ID is invalid.");
  }
  return issuerId;
}

async function googleAccessToken(credentials: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (
    cachedAccessToken &&
    cachedAccessToken.serviceAccountEmail === credentials.client_email &&
    cachedAccessToken.expiresAt > now + 60
  ) {
    return cachedAccessToken.accessToken;
  }

  const assertion = signJwt(
    {
      iss: credentials.client_email,
      scope: GOOGLE_WALLET_SCOPE,
      aud: GOOGLE_TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    },
    credentials.private_key,
  );
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Google Wallet authentication failed (${response.status}).`);
  }

  const body = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof body.access_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw new Error("Google Wallet authentication returned an invalid response.");
  }

  cachedAccessToken = {
    accessToken: body.access_token,
    expiresAt: now + Math.max(60, Math.min(body.expires_in, 3600)),
    serviceAccountEmail: credentials.client_email,
  };
  return body.access_token;
}

async function walletApiRequest(
  path: string,
  accessToken: string,
  init: RequestInit = {},
) {
  return fetch(`${GOOGLE_WALLET_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

async function upsertWalletResource(
  resourceName: "loyaltyClass" | "loyaltyObject",
  id: string,
  resource: Record<string, unknown>,
  accessToken: string,
) {
  const encodedId = encodeURIComponent(id);
  const existing = await walletApiRequest(
    `/${resourceName}/${encodedId}`,
    accessToken,
  );
  if (existing.ok) {
    const updatedResource = resourceName === "loyaltyObject"
      ? { ...resource, notifyPreference: "NOTIFY_ON_UPDATE" }
      : resource;
    const updated = await walletApiRequest(
      `/${resourceName}/${encodedId}`,
      accessToken,
      { method: "PATCH", body: JSON.stringify(updatedResource) },
    );
    if (!updated.ok) {
      throw new Error(`Google Wallet ${resourceName} update failed (${updated.status}).`);
    }
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`Google Wallet ${resourceName} lookup failed (${existing.status}).`);
  }

  const created = await walletApiRequest(`/${resourceName}`, accessToken, {
    method: "POST",
    body: JSON.stringify(resource),
  });
  if (created.ok) return;

  // A concurrent request can create the resource after the lookup.
  if (created.status === 409) {
    const updated = await walletApiRequest(
      `/${resourceName}/${encodedId}`,
      accessToken,
      { method: "PATCH", body: JSON.stringify(resource) },
    );
    if (updated.ok) return;
  }
  throw new Error(`Google Wallet ${resourceName} creation failed (${created.status}).`);
}

export async function syncGoogleWalletPass(
  passData: Omit<GoogleWalletPassData, "issuerId">,
) {
  const issuerId = configuredIssuerId();
  const credentials = parseGoogleWalletServiceAccount();
  const resources = buildGoogleWalletResources({ ...passData, issuerId });
  const accessToken = await googleAccessToken(credentials);

  await upsertWalletResource(
    "loyaltyClass",
    resources.classId,
    resources.loyaltyClass,
    accessToken,
  );
  await upsertWalletResource(
    "loyaltyObject",
    resources.objectId,
    resources.loyaltyObject,
    accessToken,
  );

  const now = Math.floor(Date.now() / 1000);
  const saveJwt = signJwt(
    {
      iss: credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: [new URL(passData.cardUrl).origin],
      payload: { loyaltyObjects: [{ id: resources.objectId }] },
    },
    credentials.private_key,
  );

  return {
    classId: resources.classId,
    objectId: resources.objectId,
    saveUrl: `https://pay.google.com/gp/v/save/${saveJwt}`,
  };
}
