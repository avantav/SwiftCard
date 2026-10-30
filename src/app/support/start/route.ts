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
import { resolvePublicRequestOrigin } from "@/lib/public-origin";

function supportPage(request: NextRequest, tenantId: string, error?: string) {
  const origin = resolvePublicRequestOrigin(request.url, request.headers);
  const url = new URL(`/superadmin/tenants/${encodeURIComponent(tenantId)}/support`, origin);
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function POST(request: NextRequest) {
  const origin = resolvePublicRequestOrigin(request.url, request.headers);
  const context = await getActiveSuperadminContext();
  const formData = await request.formData();
  const tenantId = String(formData.get("tenantId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!context || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return NextResponse.redirect(new URL("/login?error=account_unavailable", origin), 303);
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
    console.error("[support] start session failed", {
      code: error?.code ?? "INVALID_RPC_RESPONSE",
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      message: error?.message ?? "RPC returned an unexpected response",
      tenantId,
      userId: context.userId
    });
    return NextResponse.redirect(supportPage(request, tenantId, "unavailable"), 303);
  }

  const response = NextResponse.redirect(new URL("/admin", origin), 303);
  response.cookies.set(SUPPORT_SESSION_COOKIE, token, supportSessionCookieOptions);
  return response;
}
