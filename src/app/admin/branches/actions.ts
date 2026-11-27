"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  describeBranchPersistenceError,
  type BranchAccessActionState,
  type BranchCreateActionState,
  type BranchCreateFieldErrors,
  type BranchCreateInput,
  type BranchUpdateActionState,
  type BranchUpdateInput,
  type GeofencePolicyActionState,
  validateBranchCreateForm,
  validateBranchUpdateForm,
  validateSharedAccessCredentials,
} from "@/lib/admin/branches";
import { requireInternalArea } from "@/lib/auth/server";
import { withNotice } from "@/lib/forms/notices";
import { errorState } from "@/lib/forms/state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function valuesFromInput(data: BranchCreateInput) {
  return {
    name: data.name,
    address: data.address ?? "",
    latitude: data.latitude?.toString() ?? "",
    longitude: data.longitude?.toString() ?? "",
    geofenceRadiusMeters: data.geofenceRadiusMeters.toString(),
    proximityEnabled: data.proximityEnabled,
    employeeAccessMode: data.employeeAccessMode,
    sharedEmail: data.sharedEmail ?? "",
  };
}

function createErrorState(
  data: BranchCreateInput,
  formError: string,
  fieldErrors: BranchCreateFieldErrors = {},
): BranchCreateActionState {
  return {
    status: "error",
    formError,
    fieldErrors,
    values: valuesFromInput(data),
  };
}

function logCreateFailure(
  stage: string,
  error: { code?: string; message?: string; status?: number } | null,
) {
  console.error("[branch-create]", {
    stage,
    code: error?.code ?? "NO_CODE",
    message: error?.message ?? "No error payload returned",
    status: error?.status,
  });
}

function updateValuesFromInput(data: BranchUpdateInput) {
  return {
    name: data.name,
    address: data.address ?? "",
    latitude: data.latitude?.toString() ?? "",
    longitude: data.longitude?.toString() ?? "",
    geofenceRadiusMeters: data.geofenceRadiusMeters.toString(),
    proximityEnabled: data.proximityEnabled,
    proximityMessage: data.proximityMessage ?? "",
    status: data.status,
  };
}

function createUpdateErrorState(
  data: BranchUpdateInput,
  formError: string,
  fieldErrors: BranchCreateFieldErrors = {},
): BranchUpdateActionState {
  return {
    status: "error",
    formError,
    fieldErrors,
    values: updateValuesFromInput(data),
  };
}

function logUpdateFailure(
  stage: string,
  error: { code?: string; message?: string; status?: number } | null,
) {
  console.error("[branch-update]", {
    stage,
    code: error?.code ?? "NO_CODE",
    message: error?.message ?? "No error payload returned",
    status: error?.status,
  });
}

function describeSharedAccountAuthError(error: {
  code?: string;
  message?: string;
}): { formError: string; fieldErrors: BranchCreateFieldErrors } {
  const message = error.message?.toLowerCase() ?? "";
  if (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists")
  ) {
    return {
      formError: "No se pudo crear la cuenta compartida.",
      fieldErrors: {
        sharedEmail: [
          "Este correo ya pertenece a otra cuenta. Usa un correo operativo diferente.",
        ],
      },
    };
  }
  if (message.includes("email")) {
    return {
      formError: "No se pudo crear la cuenta compartida.",
      fieldErrors: { sharedEmail: ["Supabase rechazó este correo."] },
    };
  }
  if (message.includes("password")) {
    return {
      formError: "No se pudo crear la cuenta compartida.",
      fieldErrors: {
        sharedPassword: [
          "Supabase rechazó la contraseña. Usa al menos 12 caracteres y evita una contraseña conocida o fácil de adivinar.",
        ],
      },
    };
  }
  return {
    formError: `No se pudo crear la cuenta compartida (código ${error.code ?? "AUTH_UNKNOWN"}).`,
    fieldErrors: {},
  };
}

export async function createBranch(
  _previousState: BranchCreateActionState,
  formData: FormData,
): Promise<BranchCreateActionState> {
  const validation = validateBranchCreateForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      formError: "Corrige los campos indicados antes de crear la sucursal.",
      fieldErrors: validation.fieldErrors,
      values: validation.values,
    };
  }

  const context = await requireInternalArea("ADMIN", { writable: true, allowSupportWrites: true });

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    return createErrorState(
      validation.data,
      "Solo el Admin general del tenant puede crear sucursales.",
    );
  }

  if (context.supportSession && validation.data.employeeAccessMode !== "INDIVIDUAL_CREDENTIALS") {
    return createErrorState(
      validation.data,
      "En modo soporte el acceso del personal debe configurarlo un Administrador del tenant.",
    );
  }

  let sharedAdminClient: ReturnType<typeof createSupabaseAdminClient> | null = null;
  if (validation.data.employeeAccessMode === "SHARED_ACCOUNT_PIN") {
    try {
      sharedAdminClient = createSupabaseAdminClient();
    } catch {
      return createErrorState(
        validation.data,
        "No se puede crear la cuenta compartida porque falta la configuración privada de Supabase en el servidor.",
      );
    }
  }

  const branchId = randomUUID();
  const { error } = await context.supabase.from("branches").insert({
    id: branchId,
    tenant_id: context.tenantId,
    name: validation.data.name,
    address: validation.data.address,
    latitude: validation.data.latitude,
    longitude: validation.data.longitude,
    geofence_radius_meters: validation.data.geofenceRadiusMeters,
    proximity_enabled: validation.data.proximityEnabled,
    employee_access_mode: "INDIVIDUAL_CREDENTIALS"
  });

  if (error) {
    logCreateFailure("branch_insert", error);
    const description = describeBranchPersistenceError(error);
    return createErrorState(
      validation.data,
      description.formError ?? "No se pudo crear la sucursal.",
      description.fieldErrors,
    );
  }

  if (validation.data.employeeAccessMode === "SHARED_ACCOUNT_PIN") {
    const adminClient = sharedAdminClient!;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validation.data.sharedEmail!,
      password: validation.data.sharedPassword!,
      email_confirm: true
    });
    if (authError || !authData.user) {
      await adminClient.from("branches").delete().eq("id", branchId);
      logCreateFailure("shared_auth_create", authError);
      const description = describeSharedAccountAuthError(
        authError ?? { code: "AUTH_EMPTY_RESPONSE" },
      );
      return createErrorState(
        validation.data,
        description.formError,
        description.fieldErrors,
      );
    }

    const { data: result, error: configError } = await context.supabase
      .schema("app")
      .rpc("configure_branch_shared_access", {
        target_branch_id: branchId,
        target_staff_profile_id: authData.user.id,
        target_email: validation.data.sharedEmail!
      });
    if (configError || result !== "CONFIGURED") {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from("branches").delete().eq("id", branchId);
      logCreateFailure("shared_access_config", configError);
      const description = describeBranchPersistenceError(configError);
      return createErrorState(
        validation.data,
        configError
          ? description.formError ?? "No se pudo configurar el acceso compartido."
          : `La configuración de acceso respondió ${String(result)} en lugar de CONFIGURED.`,
        description.fieldErrors,
      );
    }
  }

  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId,
  });
  redirect(withNotice(`/admin/branches?branch=${branchId}&section=details`, "branch_created"));
}

export async function updateBranch(
  _previousState: BranchUpdateActionState,
  formData: FormData,
): Promise<BranchUpdateActionState> {
  const validation = validateBranchUpdateForm(formData);

  if (!validation.ok) {
    return {
      status: "error",
      formError: "Corrige los campos indicados antes de guardar la sucursal.",
      fieldErrors: validation.fieldErrors,
      values: validation.values,
    };
  }

  const context = await requireInternalArea("ADMIN", { writable: true, allowSupportWrites: true });

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    return createUpdateErrorState(
      validation.data,
      "Solo el Admin general del tenant puede editar sucursales.",
    );
  }

  const { data: updatedBranch, error } = await context.supabase
    .from("branches")
    .update({
      name: validation.data.name,
      address: validation.data.address,
      latitude: validation.data.latitude,
      longitude: validation.data.longitude,
      geofence_radius_meters: validation.data.geofenceRadiusMeters,
      proximity_enabled: validation.data.proximityEnabled,
      proximity_message: validation.data.proximityMessage,
      status: validation.data.status,
    })
    .eq("id", validation.data.branchId)
    .eq("tenant_id", context.tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    logUpdateFailure("branch_update", error);
    const description = describeBranchPersistenceError(error, "update");
    return createUpdateErrorState(
      validation.data,
      description.formError ?? "No se pudo actualizar la sucursal.",
      description.fieldErrors,
    );
  }

  if (!updatedBranch) {
    logUpdateFailure("branch_not_found", null);
    return createUpdateErrorState(
      validation.data,
      "La sucursal ya no existe o no pertenece a tu tenant. Actualiza la página y vuelve a intentarlo.",
    );
  }

  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId,
  });
  redirect(withNotice(`/admin/branches?branch=${validation.data.branchId}&section=details`, "branch_updated"));
}

/**
 * Changes how a branch's staff signs in. Returns state on error so the
 * dialog stays open with the typed email (DEC-0073); passwords are never
 * echoed back.
 */
export async function configureBranchAccess(
  _previousState: BranchAccessActionState,
  formData: FormData,
): Promise<BranchAccessActionState> {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const accessMode = String(formData.get("employeeAccessMode") ?? "");
  const values = { employeeAccessMode: accessMode, sharedEmail: String(formData.get("sharedEmail") ?? "").trim() };
  const fail = (formError: string, fieldErrors: BranchAccessActionState["fieldErrors"] = {}): BranchAccessActionState =>
    ({ ...errorState(values, {}, formError), fieldErrors });
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN" || !branchId || !context.tenantId) {
    return fail("Solo el Administrador general puede cambiar este acceso.");
  }

  // SEC-002: prove tenant ownership with the RLS-scoped session client before
  // any service-role read or Auth mutation. Never trust the submitted branch.
  const { data: ownedBranch, error: ownershipError } = await context.supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (ownershipError || !ownedBranch) {
    return fail("La sucursal no existe o no pertenece a tu negocio.");
  }

  if (accessMode !== "INDIVIDUAL_CREDENTIALS" && accessMode !== "SHARED_ACCOUNT_PIN") {
    return fail("El modo de acceso no es válido.", { employeeAccessMode: ["Elige un modo de acceso."] });
  }

  const credentials = accessMode === "SHARED_ACCOUNT_PIN" ? validateSharedAccessCredentials(formData) : null;
  if (credentials && !credentials.ok) {
    return fail("Revisa las credenciales de la cuenta compartida.", credentials.fieldErrors);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    return fail("La service role no está configurada.");
  }

  const { data: existing } = await adminClient
    .from("branch_shared_accounts")
    .select("staff_profile_id")
    .eq("branch_id", branchId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  const successHref = withNotice(`/admin/branches?branch=${encodeURIComponent(branchId)}&section=access`, "branch_access_saved");

  if (accessMode === "INDIVIDUAL_CREDENTIALS") {
    const { data, error } = await context.supabase
      .schema("app")
      .rpc("disable_branch_shared_access", { target_branch_id: branchId });
    if (error || data !== "DISABLED") {
      return fail("No se pudo cambiar el modo de acceso.");
    }
    if (existing?.staff_profile_id) {
      await adminClient.auth.admin.updateUserById(existing.staff_profile_id, {
        ban_duration: "876000h"
      });
    }
    redirect(successHref);
  }

  if (!credentials?.ok) return fail("Credenciales compartidas inválidas.");
  const shared = credentials.data;

  let staffProfileId = existing?.staff_profile_id as string | undefined;
  let createdNewUser = false;
  if (staffProfileId) {
    const { error } = await adminClient.auth.admin.updateUserById(staffProfileId, {
      email: shared.email,
      password: shared.password,
      email_confirm: true,
      ban_duration: "none"
    });
    if (error) return fail("No se pudieron actualizar las credenciales compartidas.");
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: shared.email,
      password: shared.password,
      email_confirm: true
    });
    if (error || !data.user) {
      return fail("No se pudo crear la cuenta compartida.", { sharedEmail: ["Revisa que el correo no pertenezca a otra cuenta."] });
    }
    staffProfileId = data.user.id;
    createdNewUser = true;
  }

  const { data, error } = await context.supabase
    .schema("app")
    .rpc("configure_branch_shared_access", {
      target_branch_id: branchId,
      target_staff_profile_id: staffProfileId,
      target_email: shared.email
    });
  if (error || data !== "CONFIGURED") {
    if (createdNewUser && staffProfileId) await adminClient.auth.admin.deleteUser(staffProfileId);
    return fail("No se pudo activar el acceso por PIN.");
  }

  redirect(successHref);
}

/** Tenant-wide GPS policy; returns state on error (DEC-0073). */
export async function configureTenantGeofencing(
  _previousState: GeofencePolicyActionState,
  formData: FormData,
): Promise<GeofencePolicyActionState> {
  const targetMode = String(formData.get("locationValidationMode") ?? "");
  const fail = (formError: string): GeofencePolicyActionState => errorState({ locationValidationMode: targetMode }, {}, formError);
  if (targetMode !== "STRICT" && targetMode !== "FLEXIBLE") {
    return fail("El modo de validación de ubicación no es válido.");
  }
  const context = await requireInternalArea("ADMIN", { writable: true, allowSupportWrites: true });
  if (context.access.role !== "ADMIN") {
    return fail("Solo el Administrador general puede cambiar el geofence.");
  }
  const { data, error } = await context.supabase
    .schema("app")
    .rpc(
      context.supportSession
        ? "support_set_tenant_location_validation_mode"
        : "set_tenant_location_validation_mode",
      context.supportSession
        ? {
            target_mode: targetMode,
            target_tenant_id: context.tenantId,
            target_token_hash: context.supportSessionTokenHash
          }
        : { target_mode: targetMode },
    );
  if (error) return fail("No se pudo actualizar la validación de ubicación.");
  if (data === "MISSING_COORDINATES") {
    return fail("Todas las sucursales activas deben tener una ubicación seleccionada antes de activar el geofence.");
  }
  if (data !== "UPDATED" && data !== "UNCHANGED") {
    return fail("No tienes permiso para cambiar la validación de ubicación.");
  }
  redirect(withNotice("/admin/branches", "geofence_saved"));
}
