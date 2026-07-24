"use server";

import { redirect } from "next/navigation";
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

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    redirectToLogin("invalid_credentials", nextPath);
  }

  redirect(nextPath);
}

