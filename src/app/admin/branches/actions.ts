"use server";

import { redirect } from "next/navigation";
import { validateBranchCreateForm } from "@/lib/admin/branches";
import { requireInternalArea } from "@/lib/auth/server";

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

  const { error } = await context.supabase.from("branches").insert({
    tenant_id: context.tenantId,
    name: validation.data.name,
    address: validation.data.address,
    latitude: validation.data.latitude,
    longitude: validation.data.longitude,
    geofence_radius_meters: validation.data.geofenceRadiusMeters,
    proximity_enabled: validation.data.proximityEnabled
  });

  if (error) {
    redirectWithError("No se pudo crear la sucursal.");
  }

  redirect("/admin/branches?created=1");
}
