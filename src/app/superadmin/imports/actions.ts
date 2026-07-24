"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { importFileType, parseImportFile, validateImportFile } from "@/lib/superadmin/imports";

function redirectWithError(error: string): never {
  redirect(`/superadmin/imports?error=${encodeURIComponent(error)}`);
}

export async function uploadCustomerImport(formData: FormData) {
  const superadmin = await getActiveSuperadminContext();
  if (!superadmin) redirectWithError("No tienes permisos para importar clientes.");

  const file = formData.get("file");
  if (!(file instanceof File)) redirectWithError("Selecciona un archivo.");
  const validation = validateImportFile(file);
  if (!validation.ok) redirectWithError(validation.error);

  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "No se pudo leer el archivo.");
  }

  if (parsed.rows.length > 5000) redirectWithError("El archivo supera el máximo de 5,000 filas.");

  const { data, error } = await superadmin.supabase
    .from("customer_imports")
    .insert({
      tenant_id: formData.get("tenantId"),
      file_name: file.name,
      file_type: importFileType(file),
      file_size_bytes: file.size,
      raw_rows: parsed.rows,
      total_rows: parsed.rows.length,
      uploaded_by: superadmin.userId
    })
    .select("id")
    .single();

  if (error || !data) redirectWithError("No se pudo registrar el archivo.");
  redirect(`/superadmin/imports/${data.id}/mapping`);
}
