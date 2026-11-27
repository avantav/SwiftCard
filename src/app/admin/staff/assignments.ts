"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { withNotice } from "@/lib/forms/notices";

/** Same branch, person and section as the dialog that submitted (DEC-0073). */
function dialogUrl(formData: FormData, extra: Record<string, string> = {}) {
  const values: Record<string, string> = {};
  for (const key of ["returnBranch", "returnStaff", "returnSection"] as const) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) values[key.replace("return", "").toLowerCase()] = value;
  }
  return `/admin/staff?${new URLSearchParams({ ...values, ...extra })}`;
}

function redirectWithError(formData: FormData, error: string): never {
  redirect(dialogUrl(formData, { error }));
}

export async function assignStaffBranch(formData: FormData) {
  const staffProfileId = formData.get("staffProfileId");
  const branchId = formData.get("branchId");
  const makePrimary = formData.get("makePrimary") === "on";

  if (typeof staffProfileId !== "string" || typeof branchId !== "string" || !branchId) {
    redirectWithError(formData, "El personal y la sucursal son obligatorios.");
  }

  // Writable: support sessions are read-only here and pending legal
  // acceptance blocks it, like every other write (DEC-0072, DEC-0073).
  const context = await requireInternalArea("ADMIN", { writable: true });

  const { data, error } = context.access.role === "ADMIN"
    ? await context.supabase.schema("app").rpc("set_staff_branch_assignment", {
      target_staff_profile_id: staffProfileId,
      target_branch_id: branchId,
      should_assign: true,
      make_primary: makePrimary
    })
    : await context.supabase.schema("app").rpc("assign_scoped_employee_branch", {
      target_staff_profile_id: staffProfileId,
      target_branch_id: branchId,
      make_primary: makePrimary
    });

  if (error || (context.access.role === "MANAGER" && data !== "ASSIGNED")) {
    redirectWithError(formData, "No se pudo asignar la sucursal.");
  }

  redirect(withNotice(dialogUrl(formData), "staff_updated"));
}
