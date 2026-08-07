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

export function publicRegistrationUrl(origin: string, branchToken: string) {
  const publicOrigin = resolvePublicOrigin(origin);
  if (!publicOrigin || !branchToken.trim() || branchToken.length > 256) {
    throw new Error("Invalid public registration URL.");
  }
  return `${publicOrigin}/register/${encodeURIComponent(branchToken)}`;
}
