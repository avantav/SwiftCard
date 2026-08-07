"use server";

import { redirect } from "next/navigation";
import { validateBranchCreateForm, validateSharedAccessCredentials } from "@/lib/admin/branches";
import { requireInternalArea } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function redirectWithError(error: string): never {
  redirect(`/admin/branches?error=${encodeURIComponent(error)}`);
}

export async function createBranch(formData: FormData) {
  const validation = validateBranchCreateForm(formData);

  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "Datos de sucursal inválidos.");
  }

  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirectWithError("Solo el Administrador puede crear sucursales.");
  }

  let sharedAdminClient: ReturnType<typeof createSupabaseAdminClient> | null = null;
  if (validation.data.employeeAccessMode === "SHARED_ACCOUNT_PIN") {
    try {
      sharedAdminClient = createSupabaseAdminClient();
    } catch {
      redirectWithError("La service role no está configurada.");
    }
  }

  const { data: branch, error } = await context.supabase.from("branches").insert({
    tenant_id: context.tenantId,
    name: validation.data.name,
    address: validation.data.address,
    latitude: validation.data.latitude,
    longitude: validation.data.longitude,
    geofence_radius_meters: validation.data.geofenceRadiusMeters,
    proximity_enabled: validation.data.proximityEnabled,
    employee_access_mode: "INDIVIDUAL_CREDENTIALS"
  }).select("id").single();

  if (error || !branch) {
    redirectWithError("No se pudo crear la sucursal.");
  }

  if (validation.data.employeeAccessMode === "SHARED_ACCOUNT_PIN") {
    const adminClient = sharedAdminClient!;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validation.data.sharedEmail!,
      password: validation.data.sharedPassword!,
      email_confirm: true
    });
    if (authError || !authData.user) {
      await adminClient.from("branches").delete().eq("id", branch.id);
      redirectWithError("No se pudo crear la cuenta compartida de la sucursal.");
    }

    const { data: result, error: configError } = await context.supabase
      .schema("app")
      .rpc("configure_branch_shared_access", {
        target_branch_id: branch.id,
        target_staff_profile_id: authData.user.id,
        target_email: validation.data.sharedEmail!
      });
    if (configError || result !== "CONFIGURED") {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from("branches").delete().eq("id", branch.id);
      redirectWithError("No se pudo configurar el acceso compartido.");
    }
  }

  redirect("/admin/branches?created=1");
}

export async function configureBranchAccess(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const accessMode = String(formData.get("employeeAccessMode") ?? "");
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !branchId) {
    redirectWithError("Solo el Administrador general puede cambiar este acceso.");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.");
  }

  const { data: existing } = await adminClient
    .from("branch_shared_accounts")
    .select("staff_profile_id")
    .eq("branch_id", branchId)
    .maybeSingle();

  if (accessMode === "INDIVIDUAL_CREDENTIALS") {
    const { data, error } = await context.supabase
      .schema("app")
      .rpc("disable_branch_shared_access", { target_branch_id: branchId });
    if (error || data !== "DISABLED") {
      redirectWithError("No se pudo cambiar el modo de acceso.");
    }
    if (existing?.staff_profile_id) {
      await adminClient.auth.admin.updateUserById(existing.staff_profile_id, {
        ban_duration: "876000h"
      });
    }
    redirect("/admin/branches?accessUpdated=1");
  }

  if (accessMode !== "SHARED_ACCOUNT_PIN") {
    redirectWithError("El modo de acceso no es válido.");
  }

  const credentials = validateSharedAccessCredentials(formData);
  if (!credentials.ok) {
    redirectWithError(credentials.errors[0] ?? "Credenciales compartidas inválidas.");
  }

  let staffProfileId = existing?.staff_profile_id as string | undefined;
  let createdNewUser = false;
  if (staffProfileId) {
    const { error } = await adminClient.auth.admin.updateUserById(staffProfileId, {
      email: credentials.data.email,
      password: credentials.data.password,
      email_confirm: true,
      ban_duration: "none"
    });
    if (error) redirectWithError("No se pudieron actualizar las credenciales compartidas.");
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: credentials.data.email,
      password: credentials.data.password,
      email_confirm: true
    });
    if (error || !data.user) redirectWithError("No se pudo crear la cuenta compartida.");
    staffProfileId = data.user.id;
    createdNewUser = true;
  }

  const { data, error } = await context.supabase
    .schema("app")
    .rpc("configure_branch_shared_access", {
      target_branch_id: branchId,
      target_staff_profile_id: staffProfileId,
      target_email: credentials.data.email
    });
  if (error || data !== "CONFIGURED") {
    if (createdNewUser && staffProfileId) await adminClient.auth.admin.deleteUser(staffProfileId);
    redirectWithError("No se pudo activar el acceso por PIN.");
  }

  redirect("/admin/branches?accessUpdated=1");
}
