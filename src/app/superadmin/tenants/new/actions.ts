"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateTenantCreateForm } from "@/lib/superadmin/tenants";

function redirectWithError(error: string): never {
  redirect(`/superadmin/tenants/new?error=${encodeURIComponent(error)}`);
}

async function requireActiveSuperadmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "SUPERADMIN" && profile.status === "ACTIVE";
}

export async function createTenant(formData: FormData) {
  const validation = validateTenantCreateForm(formData);

  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "Datos inválidos.");
  }

  const isSuperadmin = await requireActiveSuperadmin();

  if (!isSuperadmin) {
    redirectWithError("No tienes permisos para crear tenants.");
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirectWithError("La service role no está configurada.");
  }

  const { data, error } = await adminClient
    .from("tenants")
    .insert({
      name: validation.data.name,
      contact_name: validation.data.contactName,
      contact_email: validation.data.contactEmail,
      contact_phone: validation.data.contactPhone,
      status: validation.data.status,
      currency_code: validation.data.currencyCode,
      timezone: validation.data.timezone,
      branding_mode: validation.data.brandingMode,
      primary_color: validation.data.primaryColor,
      secondary_color: validation.data.secondaryColor
    })
    .select("id")
    .single();

  if (error || !data) {
    redirectWithError("No se pudo crear el tenant.");
  }

  redirect(`/superadmin?tenantCreated=${data.id}`);
}

