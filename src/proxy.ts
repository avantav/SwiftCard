import { type NextRequest, NextResponse } from "next/server";
import { hasAuthCookie, isProtectedPath } from "@/lib/auth/proxy-rules";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { copyAuthCookies, updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase session cookies (server components cannot write
 * them) and sends anonymous requests for protected areas to /login. Pages and
 * server actions keep their own role, status and tenant checks.
 *
 * Must live in src/ next to app/: a root-level file is ignored by Next.js.
 */
function redirectToLogin(request: NextRequest, response: NextResponse) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set(
    "next",
    getSafeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
  );

  const redirectResponse = NextResponse.redirect(redirectUrl);
  copyAuthCookies(response, redirectResponse);
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const protectedPath = isProtectedPath(request.nextUrl.pathname);
  const hasSession = hasAuthCookie(request.cookies.getAll().map((cookie) => cookie.name));

  if (!hasSession) {
    return protectedPath ? redirectToLogin(request, NextResponse.next()) : NextResponse.next();
  }

  const auth = await updateSupabaseSession(request);
  if (protectedPath && auth.configured && !auth.user) {
    return redirectToLogin(request, auth.response);
  }
  return auth.response;
}

export const config = {
  matcher: [
    // Skip static assets, files with an extension, and API routes that
    // authenticate on their own (webhooks, Wallet devices). /api/admin uses the
    // staff session and keeps going through the proxy.
    "/((?!_next/static|_next/image|favicon.ico|api/(?!admin/)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|md|webmanifest|js|json|pkpass)$).*)"
  ]
};
