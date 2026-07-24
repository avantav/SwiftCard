"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  provisionFirstAdministrator,
  resetAdministratorTemporaryPassword,
  validateFirstAdministratorForm,
  validateTemporaryPasswordForm,
  type AdministratorProvisioningResult
} from "@/lib/superadmin/administrators";

function route(tenantId: string, parameter: string, value: string) {
  return `/superadmin/tenants/${encodeURIComponent(tenantId)}/administrator/new?${parameter}=${encodeURIComponent(value)}`;
}

function provisioningErrorMessage(
  reason: Extract<AdministratorProvisioningResult, { ok: false }>["reason"]
) {
  switch (reason) {
    case "ADMINISTRATOR_EXISTS":
      return "Este tenant ya tiene un Administrador.";
    case "ADMINISTRATOR_CHECK_FAILED":
      return "No se pudo verificar el Administrador actual del tenant.";
    case "PROFILE_CREATE_FAILED_CLEANUP_FAILED":
      return "No se pudo completar el Administrador y quedó una cuenta de Auth pendiente de revisión.";
    case "AUTH_USER_CREATE_FAILED":
      return "No se pudo crear el usuario de acceso. Verifica que el correo no esté registrado.";
    case "PROFILE_CREATE_FAILED":
      return "No se pudo crear el perfil del Administrador.";
  }
}

export async function createFirstAdministrator(
  tenantId: string,
  formData: FormData
) {
  const validation = validateFirstAdministratorForm(formData);

  if (!validation.ok) {
    redirect(
      route(
        tenantId,
        "error",
        validation.errors[0] ?? "Datos del Administrador inválidos."
      )
    );
  }

  const superadmin = await getActiveSuperadminContext();

  if (!superadmin) {
    redirect(
      route(tenantId, "error", "No tienes permisos para crear Administradores.")
    );
  }

  const { data: tenant } = await superadmin.supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    redirect(route(tenantId, "error", "El tenant no existe."));
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirect(route(tenantId, "error", "La service role no está configurada."));
  }

  const result = await provisionFirstAdministrator(
    tenantId,
    superadmin.userId,
    validation.data,
    {
      async administratorExists(targetTenantId) {
        const { data, error } = await adminClient
          .from("staff_profiles")
          .select("id")
          .eq("tenant_id", targetTenantId)
          .eq("role", "ADMIN")
          .limit(1)
          .maybeSingle();

        return error ? null : Boolean(data);
      },
      async createAuthUser(input) {
        const { data, error } = await adminClient.auth.admin.createUser({
          email: input.email,
          password: input.temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: input.fullName
          }
        });

        return error || !data.user ? null : { userId: data.user.id };
      },
      async createStaffProfile(profile) {
        const { error } = await adminClient.rpc(
          "create_first_tenant_administrator",
          {
            target_tenant_id: profile.tenantId,
            target_user_id: profile.id,
            target_email: profile.email,
            target_full_name: profile.fullName,
            created_by_superadmin_id: profile.createdBy
          }
        );

        return !error;
      },
      async deleteAuthUser(userId) {
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        return !error;
      }
    }
  );

  if (!result.ok) {
    redirect(route(tenantId, "error", provisioningErrorMessage(result.reason)));
  }

  redirect(route(tenantId, "administratorCreated", result.userId));
}

export async function resetAdministratorPassword(
  tenantId: string,
  administratorId: string,
  formData: FormData
) {
  const validation = validateTemporaryPasswordForm(formData);

  if (!validation.ok) {
    redirect(
      route(
        tenantId,
        "error",
        validation.errors[0] ?? "Contraseña temporal inválida."
      )
    );
  }

  const superadmin = await getActiveSuperadminContext();

  if (!superadmin) {
    redirect(
      route(
        tenantId,
        "error",
        "No tienes permisos para restablecer contraseñas."
      )
    );
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirect(route(tenantId, "error", "La service role no está configurada."));
  }

  const result = await resetAdministratorTemporaryPassword(
    tenantId,
    administratorId,
    validation.data.temporaryPassword,
    {
      async markPasswordResetRequired(targetTenantId, targetAdministratorId) {
        const { error } = await adminClient.rpc(
          "mark_tenant_administrator_password_reset",
          {
            target_tenant_id: targetTenantId,
            target_administrator_id: targetAdministratorId,
            requested_by_superadmin_id: superadmin.userId
          }
        );

        return !error;
      },
      async updateAuthPassword(targetAdministratorId, temporaryPassword) {
        const { error } = await adminClient.auth.admin.updateUserById(
          targetAdministratorId,
          {
            password: temporaryPassword
          }
        );

        return !error;
      }
    }
  );

  if (!result.ok) {
    const message =
      result.reason === "PROFILE_MARK_FAILED"
        ? "No se pudo bloquear el perfil para el cambio de contraseña."
        : "El perfil quedó bloqueado, pero Auth no aceptó la contraseña. Vuelve a intentarlo.";

    redirect(route(tenantId, "error", message));
  }

  redirect(route(tenantId, "passwordReset", "1"));
}
