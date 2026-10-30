export function resolvePublicOrigin(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const localHttp =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !localHttp) ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function resolvePublicRequestOrigin(
  requestUrl: string,
  requestHeaders: Headers,
  configuredOrigin?: string | null,
) {
  const configured = resolvePublicOrigin(
    configuredOrigin === undefined
      ? process.env.SWIFTWALLET_PUBLIC_URL
      : configuredOrigin,
  );
  if (configured) return configured;

  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host")?.trim();
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(requestUrl).protocol.replace(":", "");

  if (host) {
    const forwardedOrigin = resolvePublicOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return new URL(requestUrl).origin;
}

export function publicRegistrationUrl(origin: string, branchToken: string) {
  const publicOrigin = resolvePublicOrigin(origin);
  if (!publicOrigin || !branchToken.trim() || branchToken.length > 256) {
    throw new Error("Invalid public registration URL.");
  }
  return `${publicOrigin}/register/${encodeURIComponent(branchToken)}`;
}
