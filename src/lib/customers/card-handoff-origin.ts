import "server-only";

import { headers } from "next/headers";
import { resolvePublicOrigin } from "@/lib/public-origin";

export async function resolveCustomerCardHandoffOrigin() {
  const configuredOrigin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
  if (configuredOrigin || process.env.NODE_ENV === "production") return configuredOrigin;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  try {
    const requestOrigin = host ? new URL(`${protocol}://${host}`) : null;
    return requestOrigin && ["http:", "https:"].includes(requestOrigin.protocol)
      ? requestOrigin.origin
      : null;
  } catch {
    return null;
  }
}
