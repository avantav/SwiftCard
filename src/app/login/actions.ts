"use server";

import { redirect } from "next/navigation";
import { STAFF_ROLES, STAFF_STATUSES } from "@/lib/auth/permissions";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToLogin(error: string, nextPath: string): never {
  const params = new URLSearchParams({
    error,
    next: nextPath
  });

  redirect(`/login?${params.toString()}`);
}

export async function signInWithPassword(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const nextPath = getSafeRedirectPath(formData.get("next"));

  if (typeof email !== "string" || typeof password !== "string") {
    redirectToLogin("missing_credentials", nextPath);
  }

  if (email.trim().length === 0 || password.length === 0) {
    redirectToLogin("missing_credentials", nextPath);
  }

  let supabase;

  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirectToLogin("auth_not_configured", nextPath);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error || !data.user) {
    redirectToLogin("invalid_credentials", nextPath);
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role,status")
    .eq("id", data.user.id)
    .maybeSingle();

  const roleIsValid =
    typeof profile?.role === "string" &&
    STAFF_ROLES.includes(profile.role as (typeof STAFF_ROLES)[number]);
  const statusIsValid =
    typeof profile?.status === "string" &&
    STAFF_STATUSES.includes(profile.status as (typeof STAFF_STATUSES)[number]);

  if (!profile || !roleIsValid || !statusIsValid) {
    await supabase.auth.signOut();
    redirectToLogin("account_unavailable", nextPath);
  }

  if (profile.status === "PASSWORD_RESET_REQUIRED") {
    redirect("/change-password");
  }

  if (profile.status !== "ACTIVE") {
    await supabase.auth.signOut();
    redirectToLogin("account_unavailable", nextPath);
  }

  redirect(nextPath);
}
