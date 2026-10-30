import { NextResponse, type NextRequest } from "next/server";
import { getStaffSessionContext } from "@/lib/auth/server";
import {
  SUPPORT_SESSION_COOKIE,
  supportSessionCookieOptions
} from "@/lib/auth/support-cookie";
import { hashSupportSessionToken } from "@/lib/auth/support-session";
import { resolvePublicRequestOrigin } from "@/lib/public-origin";

export async function POST(request: NextRequest) {
  const origin = resolvePublicRequestOrigin(request.url, request.headers);
  const context = await getStaffSessionContext();
  const token = request.cookies.get(SUPPORT_SESSION_COOKIE)?.value;

  if (context?.actorAccess.role === "SUPERADMIN" && token) {
    await context.supabase.schema("app").rpc("end_support_impersonation_session", {
      target_token_hash: hashSupportSessionToken(token)
    });
  }

  const response = NextResponse.redirect(new URL("/superadmin", origin), 303);
  response.cookies.set(SUPPORT_SESSION_COOKIE, "", {
    ...supportSessionCookieOptions,
    maxAge: 0
  });
  return response;
}
