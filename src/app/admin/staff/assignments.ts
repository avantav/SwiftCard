"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";

function redirectWithError(error: string): never {
  redirect(`/admin/staff?error=${encodeURIComponent(error)}`);
}

export async function assignStaffBranch(formData: FormData) {
  const staffProfileId = formData.get("staffProfileId");
  const branchId = formData.get("branchId");
  const makePrimary = formData.get("makePrimary") === "on";

  if (typeof staffProfileId !== "string" || typeof branchId !== "string") {
    redirectWithError("El personal y la sucursal son obligatorios.");
  }

  const context = await requireInternalArea("ADMIN");

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
    redirectWithError("No se pudo asignar la sucursal.");
  }

  redirect("/admin/staff?assigned=1");
}
