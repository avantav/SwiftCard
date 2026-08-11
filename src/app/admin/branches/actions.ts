"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  describeBranchPersistenceError,
  type BranchCreateActionState,
  type BranchCreateFieldErrors,
  type BranchCreateInput,
  validateBranchCreateForm,
  validateSharedAccessCredentials,
} from "@/lib/admin/branches";
import { requireInternalArea } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function redirectWithError(error: string): never {
  redirect(`/admin/branches?error=${encodeURIComponent(error)}`);
}

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

  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    return createErrorState(
      validation.data,
      "Solo el Admin general del tenant puede crear sucursales.",
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
