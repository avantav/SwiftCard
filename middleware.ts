import { type NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import {
  copyAuthCookies,
  updateSupabaseSession
} from "@/lib/supabase/middleware";
import { SUPPORT_SESSION_COOKIE } from "@/lib/auth/support-cookie";

const protectedPrefixes = ["/superadmin", "/admin", "/app", "/change-password"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.searchParams.set(
    "next",
    getSafeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
  );

  const redirectResponse = NextResponse.redirect(redirectUrl);
  copyAuthCookies(response, redirectResponse);
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const auth = await updateSupabaseSession(request);

  if (isProtectedPath(request.nextUrl.pathname) && !auth.user) {
    return redirectToLogin(request, auth.response);
  }

  if (
    request.cookies.has(SUPPORT_SESSION_COOKIE) &&
    request.nextUrl.pathname.startsWith("/admin") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin";
    redirectUrl.search = "?supportError=read_only";
    const response = NextResponse.redirect(redirectUrl, 303);
    copyAuthCookies(auth.response, response);
    return response;
  }

  return auth.response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
