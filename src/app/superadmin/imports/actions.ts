"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { importFileType, parseImportFile, type ImportColumnMapping, validateImportFile, validateMappedRows } from "@/lib/superadmin/imports";
import { normalizePhone } from "@/lib/customers/phone";

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

export async function previewCustomerImport(formData: FormData) {
  const superadmin = await getActiveSuperadminContext();
  if (!superadmin) redirectWithError("No tienes permisos para previsualizar importaciones.");
  const importId = String(formData.get("importId") ?? "");
  const mapping: ImportColumnMapping = {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    birthDate: String(formData.get("birthDate") ?? "") || undefined,
    initialStamps: String(formData.get("initialStamps") ?? "") || undefined
  };
  if (!importId || !mapping.fullName || !mapping.phone) redirectWithError("Nombre y teléfono son obligatorios.");
  const { data: record } = await superadmin.supabase.from("customer_imports").select("raw_rows").eq("id", importId).maybeSingle();
  if (!record) redirectWithError("La importación no existe.");
  const rows = Array.isArray(record.raw_rows) ? record.raw_rows as Array<Record<string, string>> : [];
  const errors = validateMappedRows(rows, mapping);
  const { error } = await superadmin.supabase.from("customer_imports").update({ mapped_columns: mapping, preview_errors: errors, error_rows: errors.length, status: "PREVIEWED" }).eq("id", importId);
  if (error) redirectWithError("No se pudo guardar la previsualización.");
  redirect(`/superadmin/imports/${importId}/mapping?preview=1`);
}

export async function confirmCustomerImport(formData: FormData) {
  const superadmin = await getActiveSuperadminContext();
  if (!superadmin) redirectWithError("No tienes permisos para confirmar importaciones.");
  const importId = String(formData.get("importId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const { data: record } = await superadmin.supabase.from("customer_imports").select("raw_rows,mapped_columns,preview_errors").eq("id", importId).maybeSingle();
  if (!record || !branchId) redirectWithError("La importación y sucursal son obligatorias.");
  const mapping = record.mapped_columns as ImportColumnMapping;
  const rows = Array.isArray(record.raw_rows) ? record.raw_rows as Array<Record<string, string>> : [];
  const errors = Array.isArray(record.preview_errors) ? record.preview_errors as Array<{ row: number }> : [];
  const invalidRows = new Set(errors.map((error) => error.row));
  const validRows = rows.flatMap((row, index) => {
    if (invalidRows.has(index + 2)) return [];
    const phone = normalizePhone(row[mapping.phone] ?? "");
    if (!phone.ok) return [];
    return [{ full_name: row[mapping.fullName]?.trim(), normalized_phone: phone.value, email: mapping.email ? row[mapping.email]?.trim() : "", birth_date: mapping.birthDate ? row[mapping.birthDate]?.trim() : "", initial_stamps: mapping.initialStamps ? row[mapping.initialStamps]?.trim() || "0" : "0" }];
  });
  const { data, error } = await superadmin.supabase.rpc("confirm_customer_import", { target_import_id: importId, target_branch_id: branchId, valid_rows: validRows });
  if (error || !data) redirectWithError("No se pudo confirmar la importación.");
  redirect(`/superadmin/imports/${importId}/mapping?confirmed=1&imported=${data.imported}&duplicates=${data.duplicates}&errors=${data.errors}`);
}
