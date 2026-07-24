import { type NextRequest, NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import {
  copyAuthCookies,
  updateSupabaseSession
} from "@/lib/supabase/middleware";

const protectedPrefixes = ["/superadmin", "/admin", "/app"];

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

  return auth.response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};

