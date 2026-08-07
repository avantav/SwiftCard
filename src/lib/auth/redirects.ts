const DEFAULT_AUTH_REDIRECT = "/app";

export function getSafeRedirectPath(
  candidate: FormDataEntryValue | string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://swiftwallet.local");

    if (parsed.origin !== "https://swiftwallet.local") {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

