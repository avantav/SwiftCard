"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateStaffCreateForm } from "@/lib/admin/staff";

function redirectWithError(error: string): never {
  redirect(`/admin/staff?error=${encodeURIComponent(error)}`);
}

export async function createStaff(formData: FormData) {
  const validation = validateStaffCreateForm(formData);

  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "Datos de personal inválidos.");
  }

  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirectWithError("Solo el Administrador puede crear personal.");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.");
  }

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: validation.data.fullName }
    });

  if (authError || !authData.user) {
    redirectWithError("No se pudo crear el usuario de acceso.");
  }

  const { error: profileError } = await context.supabase
    .from("staff_profiles")
    .insert({
      id: authData.user.id,
      tenant_id: context.tenantId,
      email: validation.data.email,
      full_name: validation.data.fullName,
      role: validation.data.role,
      status: "PASSWORD_RESET_REQUIRED",
      created_by: context.userId
    });

  if (profileError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
      authData.user.id
    );

    redirectWithError(
      cleanupError
        ? "No se pudo crear el perfil y una cuenta de Auth quedó pendiente de revisión."
        : "No se pudo crear el perfil del personal."
    );
  }

  redirect("/admin/staff?created=1");
}
