"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateImportFile, importFileType } from "@/lib/superadmin/imports";

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

  const { data, error } = await superadmin.supabase
    .from("customer_imports")
    .insert({
      tenant_id: formData.get("tenantId"),
      file_name: file.name,
      file_type: importFileType(file),
      file_size_bytes: file.size,
      raw_rows: [],
      uploaded_by: superadmin.userId
    })
    .select("id")
    .single();

  if (error || !data) redirectWithError("No se pudo registrar el archivo.");
  redirect(`/superadmin/imports/${data.id}/mapping`);
}
