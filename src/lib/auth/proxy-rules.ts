import { swiftWalletAuthCookieOptions } from "@/lib/supabase/auth-cookies";

/** Areas that require a staff session; pages still enforce role and status. */
export const PROTECTED_PREFIXES = ["/superadmin", "/admin", "/app", "/change-password"] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * True when the request carries a Supabase auth cookie (possibly chunked as
 * `swiftwallet-auth.0`, `.1`, ...). Anonymous visitors skip the Auth call.
 */
export function hasAuthCookie(cookieNames: string[]) {
  const name = swiftWalletAuthCookieOptions.name;
  return cookieNames.some((cookie) => cookie === name || cookie.startsWith(`${name}.`));
}
