"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateStaffCreateForm } from "@/lib/admin/staff";

function staffUrl(values: Record<string, string>) {
  return `/admin/staff?${new URLSearchParams(values)}`;
}

function redirectWithError(error: string, branchId = ""): never {
  redirect(staffUrl({ ...(branchId ? { branch: branchId } : {}), error }));
}

export async function createStaff(formData: FormData) {
  const requestedBranchId = String(formData.get("branchId") ?? "").trim();
  const validation = validateStaffCreateForm(formData);

  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "Datos de personal inválidos.", requestedBranchId);
  }

  const context = await requireInternalArea("ADMIN");

  if (!context.tenantId || (context.access.role !== "ADMIN" && context.access.role !== "MANAGER")) {
    redirectWithError("No tienes permiso para crear personal.", requestedBranchId);
  }
  if (context.access.role === "MANAGER" && validation.data.role !== "EMPLOYEE") {
    redirectWithError("El Administrador de sucursal solo puede crear empleados.", requestedBranchId);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.", requestedBranchId);
  }

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: validation.data.fullName }
    });

  if (authError || !authData.user) {
    redirectWithError("No se pudo crear el usuario de acceso.", requestedBranchId);
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

    redirectWithError(
      cleanupError
        ? "No se pudo crear el perfil y una cuenta de Auth quedó pendiente de revisión."
        : "No se pudo crear el perfil del personal.",
      requestedBranchId,
    );
  }

  redirect(staffUrl({ branch: validation.data.branchId, created: "1" }));
}

export async function setEmployeeStatus(formData: FormData) {
  const staffProfileId = String(formData.get("staffProfileId") ?? "").trim();
  const returnBranch = String(formData.get("returnBranch") ?? "").trim();
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";
  const context = await requireInternalArea("ADMIN");
  const { data, error } = await context.supabase.schema("app").rpc("set_scoped_employee_status", {
    target_staff_profile_id: staffProfileId,
    target_status: status
  });
  if (error || data !== "UPDATED") redirectWithError("No puedes cambiar el estado de esa cuenta.", returnBranch);
  redirect(staffUrl({ ...(returnBranch ? { branch: returnBranch } : {}), staffUpdated: "1" }));
}

export async function resetEmployeePassword(formData: FormData) {
  const staffProfileId = String(formData.get("staffProfileId") ?? "").trim();
  const returnBranch = String(formData.get("returnBranch") ?? "").trim();
  const password = formData.get("temporaryPassword");
  const confirmation = formData.get("passwordConfirmation");
  if (typeof password !== "string" || password.length < 12 || password.length > 72 || password !== confirmation) {
    redirectWithError("La contraseña temporal no es válida o no coincide.", returnBranch);
  }
  const context = await requireInternalArea("ADMIN");
  const { data: allowed } = await context.supabase.schema("app").rpc("current_staff_can_manage_employee_account", {
    target_staff_profile_id: staffProfileId
  });
  if (allowed !== true) redirectWithError("No puedes restablecer esa cuenta.", returnBranch);

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.", returnBranch);
  }
  const { error } = await adminClient.auth.admin.updateUserById(staffProfileId, { password });
  if (error) redirectWithError("No se pudo actualizar la contraseña.", returnBranch);

  const { data, error: profileError } = await context.supabase.schema("app").rpc("mark_scoped_employee_password_reset", {
    target_staff_profile_id: staffProfileId
  });
  if (profileError || data !== "UPDATED") redirectWithError("La contraseña cambió, pero el perfil requiere revisión.", returnBranch);
  redirect(staffUrl({ ...(returnBranch ? { branch: returnBranch } : {}), passwordReset: "1" }));
}
