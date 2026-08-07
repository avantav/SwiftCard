"use server";

import { redirect } from "next/navigation";
import { validatePasswordChangeForm } from "@/lib/auth/passwords";
import { STAFF_ROLES, type StaffRole } from "@/lib/auth/permissions";
import { getDefaultInternalRoute } from "@/lib/auth/routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithError(error: string): never {
  redirect(`/change-password?error=${encodeURIComponent(error)}`);
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);
}

export async function changeRequiredPassword(formData: FormData) {
  const validation = validatePasswordChangeForm(formData);

  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "Contraseña inválida.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?error=account_unavailable");
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    !isStaffRole(profile.role) ||
    profile.status !== "PASSWORD_RESET_REQUIRED"
  ) {
    redirect("/login?error=account_unavailable");
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.");
  }

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: validation.data.currentPassword
  });

  if (verificationError) {
    redirectWithError("La contraseña temporal no es correcta.");
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: validation.data.newPassword
  });

  if (passwordError) {
    redirectWithError("No se pudo actualizar la contraseña.");
  }

  const { error: profileError } = await adminClient.schema("app").rpc(
    "complete_required_password_change",
    {
      target_user_id: user.id
    }
  );

  if (profileError) {
    redirectWithError(
      "La contraseña cambió, pero el perfil sigue bloqueado. Inicia sesión con la nueva contraseña y vuelve a intentarlo."
    );
  }

  redirect(getDefaultInternalRoute(profile.role));
}
