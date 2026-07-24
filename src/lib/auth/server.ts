import "server-only";

import { redirect } from "next/navigation";
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  TENANT_STATUSES,
  type StaffAccessContext,
  type StaffRole,
  type StaffStatus,
  type TenantStatus
} from "@/lib/auth/permissions";
import {
  canAccessInternalArea,
  getDefaultInternalRoute,
  type InternalArea
} from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);
}

function isStaffStatus(value: unknown): value is StaffStatus {
  return (
    typeof value === "string" && STAFF_STATUSES.includes(value as StaffStatus)
  );
}

function isTenantStatus(value: unknown): value is TenantStatus {
  return (
    typeof value === "string" && TENANT_STATUSES.includes(value as TenantStatus)
  );
}

export async function getStaffSessionContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role,status,tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isStaffRole(profile.role) || !isStaffStatus(profile.status)) {
    return null;
  }

  let tenantStatus: TenantStatus | null = null;

  if (profile.role !== "SUPERADMIN" && profile.status === "ACTIVE") {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (tenant && isTenantStatus(tenant.status)) {
      tenantStatus = tenant.status;
    }
  }

  const access: StaffAccessContext = {
    role: profile.role,
    staffStatus: profile.status,
    tenantStatus
  };

  return {
    access,
    email: user.email ?? null,
    supabase,
    tenantId: profile.tenant_id as string | null,
    userId: user.id
  };
}

export async function getActiveSuperadminContext() {
  const context = await getStaffSessionContext();

  if (
    !context ||
    context.access.role !== "SUPERADMIN" ||
    context.access.staffStatus !== "ACTIVE"
  ) {
    return null;
  }

  return context;
}

export async function requireInternalArea(area: InternalArea) {
  const context = await getStaffSessionContext();

  if (!context) {
    redirect("/login?error=account_unavailable");
  }

  if (context.access.staffStatus === "PASSWORD_RESET_REQUIRED") {
    redirect("/change-password");
  }

  if (
    context.access.role !== "SUPERADMIN" &&
    context.access.tenantStatus !== "ACTIVE"
  ) {
    redirect("/login?error=account_unavailable");
  }

  if (!canAccessInternalArea(context.access, area)) {
    redirect(getDefaultInternalRoute(context.access.role));
  }

  return context;
}

export async function requirePasswordChangeContext() {
  const context = await getStaffSessionContext();

  if (!context) {
    redirect("/login?error=account_unavailable");
  }

  if (context.access.staffStatus !== "PASSWORD_RESET_REQUIRED") {
    redirect(getDefaultInternalRoute(context.access.role));
  }

  return context;
}
