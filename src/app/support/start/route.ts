import { NextResponse, type NextRequest } from "next/server";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import {
  SUPPORT_SESSION_COOKIE,
  supportSessionCookieOptions
} from "@/lib/auth/support-cookie";
import {
  createSupportSessionToken,
  hashSupportSessionToken
} from "@/lib/auth/support-session";

function supportPage(request: NextRequest, tenantId: string, error?: string) {
  const url = new URL(`/superadmin/tenants/${encodeURIComponent(tenantId)}/support`, request.url);
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function POST(request: NextRequest) {
  const context = await getActiveSuperadminContext();
  const formData = await request.formData();
  const tenantId = String(formData.get("tenantId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!context || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return NextResponse.redirect(new URL("/login?error=account_unavailable", request.url), 303);
  }
  if (reason.length < 10 || reason.length > 500) {
    return NextResponse.redirect(supportPage(request, tenantId, "reason"), 303);
  }

  const token = createSupportSessionToken();
  const { data, error } = await context.supabase
    .schema("app")
    .rpc("start_support_impersonation_session", {
      target_reason: reason,
      target_tenant_id: tenantId,
      target_token_hash: hashSupportSessionToken(token)
    });

  if (error || !Array.isArray(data) || data.length !== 1) {
    return NextResponse.redirect(supportPage(request, tenantId, "unavailable"), 303);
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(SUPPORT_SESSION_COOKIE, token, supportSessionCookieOptions);
  return response;
}
