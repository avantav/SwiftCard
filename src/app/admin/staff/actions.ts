"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  staffCreateValues,
  staffFieldErrors,
  validateStaffCreateForm,
  type StaffCreateActionState,
} from "@/lib/admin/staff";
import { withNotice, type NoticeCode } from "@/lib/forms/notices";
import { errorState } from "@/lib/forms/state";

function staffUrl(values: Record<string, string>) {
  return `/admin/staff?${new URLSearchParams(values)}`;
}

/**
 * Where a dialog action returns: the same branch, person and section, so an
 * error or a success keeps the admin in context (DEC-0073).
 */
function dialogUrl(formData: FormData, extra: Record<string, string> = {}) {
  const values: Record<string, string> = {};
  for (const key of ["returnBranch", "returnStaff", "returnPin", "returnSection"] as const) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) values[key.replace("return", "").toLowerCase()] = value;
  }
  return staffUrl({ ...values, ...extra });
}

function backWithError(formData: FormData, error: string): never {
  redirect(dialogUrl(formData, { error }));
}

function backWithNotice(formData: FormData, notice: NoticeCode): never {
  redirect(withNotice(dialogUrl(formData), notice));
}

export async function createStaff(_previousState: StaffCreateActionState, formData: FormData): Promise<StaffCreateActionState> {
  const values = staffCreateValues(formData);
  const validation = validateStaffCreateForm(formData);

  if (!validation.ok) {
    return errorState(values, staffFieldErrors(validation.errors), "Corrige los campos indicados antes de crear la cuenta.");
  }

  const context = await requireInternalArea("ADMIN", { writable: true });

  if (!context.tenantId || (context.access.role !== "ADMIN" && context.access.role !== "MANAGER")) {
    return errorState(values, {}, "No tienes permiso para crear personal.");
  }
  if (context.access.role === "MANAGER" && validation.data.role !== "EMPLOYEE") {
    return errorState(values, { role: ["El Administrador de sucursal solo puede crear empleados."] }, "El Administrador de sucursal solo puede crear empleados.");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    return errorState(values, {}, "La service role no está configurada.");
  }

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: validation.data.fullName }
    });

  if (authError || !authData.user) {
    const taken = /already|registered|exists/i.test(authError?.message ?? "");
    return errorState(
      values,
      taken ? { email: ["Este correo ya pertenece a otra cuenta."] } : {},
      "No se pudo crear el usuario de acceso.",
    );
  }

  let profileError: { message: string } | null = null;
  if (validation.data.role === "EMPLOYEE") {
    const { data, error } = await context.supabase.schema("app").rpc("provision_branch_employee", {
      target_staff_profile_id: authData.user.id,
      target_branch_id: validation.data.branchId,
      target_email: validation.data.email,
      target_full_name: validation.data.fullName
    });
    if (error || data !== "CREATED") profileError = error ?? { message: "Provisioning failed" };
  } else {
    const { error } = await context.supabase.from("staff_profiles").insert({
      id: authData.user.id,
      tenant_id: context.tenantId,
      email: validation.data.email,
      full_name: validation.data.fullName,
      role: validation.data.role,
      status: "PASSWORD_RESET_REQUIRED",
      account_kind: "INDIVIDUAL",
      created_by: context.userId
    });
    profileError = error;
    if (!profileError) {
      const { error: assignmentError } = await context.supabase.schema("app").rpc("set_staff_branch_assignment", {
        target_staff_profile_id: authData.user.id,
        target_branch_id: validation.data.branchId,
        should_assign: true,
        make_primary: true
      });
      profileError = assignmentError;
    }
  }

  if (profileError) {
    await adminClient.from("staff_profiles").delete().eq("id", authData.user.id);
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
      authData.user.id
    );

    return errorState(
      values,
      {},
      cleanupError
        ? "No se pudo crear el perfil y una cuenta de Auth quedó pendiente de revisión."
        : "No se pudo crear el perfil del personal.",
    );
  }

  redirect(withNotice(staffUrl({ branch: validation.data.branchId }), "staff_created"));
}

export async function setEmployeeStatus(formData: FormData) {
  const staffProfileId = String(formData.get("staffProfileId") ?? "").trim();
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("set_scoped_employee_status", {
    target_staff_profile_id: staffProfileId,
    target_status: status
  });
  if (error || data !== "UPDATED") backWithError(formData, "No puedes cambiar el estado de esa cuenta.");
  backWithNotice(formData, "staff_updated");
}

export async function resetEmployeePassword(formData: FormData) {
  const staffProfileId = String(formData.get("staffProfileId") ?? "").trim();
  const password = formData.get("temporaryPassword");
  const confirmation = formData.get("passwordConfirmation");
  if (typeof password !== "string" || password.length < 12 || password.length > 72 || password !== confirmation) {
    backWithError(formData, "La contraseña temporal no es válida o no coincide.");
  }
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data: allowed } = await context.supabase.schema("app").rpc("current_staff_can_manage_employee_account", {
    target_staff_profile_id: staffProfileId
  });
  if (allowed !== true) backWithError(formData, "No puedes restablecer esa cuenta.");

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    backWithError(formData, "La service role no está configurada.");
  }
  const { error } = await adminClient.auth.admin.updateUserById(staffProfileId, { password });
  if (error) backWithError(formData, "No se pudo actualizar la contraseña.");

  const { data, error: profileError } = await context.supabase.schema("app").rpc("mark_scoped_employee_password_reset", {
    target_staff_profile_id: staffProfileId
  });
  if (profileError || data !== "UPDATED") backWithError(formData, "La contraseña cambió, pero el perfil requiere revisión.");
  backWithNotice(formData, "staff_updated");
}
