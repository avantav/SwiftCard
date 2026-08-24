"use server";

import { redirect } from "next/navigation";
import {
  CASA_GARMENDIA_IMPORT_PROFILE_CODE,
  isCasaGarmendiaTenantName,
  prepareCasaGarmendiaImport,
} from "@/lib/admin/imports";
import { requireInternalArea } from "@/lib/auth/server";
import {
  importFileType,
  parseImportFile,
  validateImportFile,
} from "@/lib/superadmin/imports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function importRedirect(params: Record<string, string>): never {
  redirect(`/admin/imports?${new URLSearchParams(params).toString()}`);
}

async function requireTenantImportAdmin() {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const { data: tenant } = await context.supabase
    .from("tenants")
    .select("name")
    .eq("id", context.tenantId)
    .maybeSingle();
  if (!tenant?.name || !isCasaGarmendiaTenantName(tenant.name)) {
    importRedirect({ error: "El perfil Casa Garmendia no está habilitado para este tenant." });
  }
  return context;
}

export async function uploadCasaGarmendiaImport(formData: FormData) {
  const context = await requireTenantImportAdmin();
  const file = formData.get("file");
  const loyaltyCardId = String(formData.get("loyaltyCardId") ?? "");
  const sourceBranchId = String(formData.get("sourceBranchId") ?? "");
  if (!(file instanceof File)) importRedirect({ error: "Selecciona un archivo." });
  if (!UUID.test(loyaltyCardId) || !UUID.test(sourceBranchId)) {
    importRedirect({ error: "Selecciona la tarjeta y sucursal de origen." });
  }
  const validation = validateImportFile(file);
  if (!validation.ok) importRedirect({ error: validation.error });

  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (error) {
    importRedirect({ error: error instanceof Error ? error.message : "No se pudo leer el archivo." });
  }
  if (!parsed.rows.length) importRedirect({ error: "El archivo no contiene clientes." });
  if (parsed.rows.length > 5000) importRedirect({ error: "El archivo supera el máximo de 5,000 filas." });

  const prepared = prepareCasaGarmendiaImport(parsed.headers, parsed.rows);
  if (!prepared.ok) importRedirect({ error: prepared.error });

  const [cardResult, branchResult, assignmentResult, confirmedResult] = await Promise.all([
    context.supabase
      .from("loyalty_cards")
      .select("id,program_id,status")
      .eq("id", loyaltyCardId)
      .eq("tenant_id", context.tenantId)
      .eq("status", "PUBLISHED")
      .maybeSingle(),
    context.supabase
      .from("branches")
      .select("id")
      .eq("id", sourceBranchId)
      .eq("tenant_id", context.tenantId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
    context.supabase
      .from("loyalty_card_branches")
      .select("branch_id")
      .eq("loyalty_card_id", loyaltyCardId)
      .eq("branch_id", sourceBranchId)
      .maybeSingle(),
    context.supabase
      .from("customer_imports")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .eq("import_profile_code", CASA_GARMENDIA_IMPORT_PROFILE_CODE)
      .eq("status", "CONFIRMED")
      .limit(1),
  ]);
  if (confirmedResult.data?.length) {
    importRedirect({ error: "Este perfil ya fue utilizado y no puede ejecutarse nuevamente." });
  }
  if (!cardResult.data || !branchResult.data || !assignmentResult.data) {
    importRedirect({ error: "La tarjeta o sucursal seleccionada no está disponible para esta importación." });
  }
  const { data: program } = await context.supabase
    .from("loyalty_programs")
    .select("program_type,status")
    .eq("id", cardResult.data.program_id)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (program?.program_type !== "LIFETIME_POINTS" || program.status !== "ACTIVE") {
    importRedirect({ error: "Selecciona una tarjeta publicada de puntos acumulativos." });
  }

  const { data, error } = await context.supabase
    .from("customer_imports")
    .insert({
      tenant_id: context.tenantId,
      file_name: file.name,
      file_type: importFileType(file),
      file_size_bytes: file.size,
      status: "PREVIEWED",
      raw_rows: parsed.rows,
      prepared_rows: prepared.preparedRows,
      total_rows: parsed.rows.length,
      error_rows: prepared.errors.length,
      mapped_columns: prepared.mapping,
      preview_errors: prepared.errors,
      uploaded_by: context.userId,
      import_profile_code: CASA_GARMENDIA_IMPORT_PROFILE_CODE,
      loyalty_card_id: loyaltyCardId,
      source_branch_id: sourceBranchId,
    })
    .select("id")
    .single();
  if (error || !data) importRedirect({ error: "No se pudo guardar la previsualización." });
  importRedirect({ importId: data.id, preview: "1" });
}

export async function confirmCasaGarmendiaImport(importId: string) {
  const context = await requireTenantImportAdmin();
  if (!UUID.test(importId)) importRedirect({ error: "La importación no es válida." });
  const { data, error } = await context.supabase.schema("app").rpc(
    "confirm_casa_garmendia_customer_import",
    { target_import_id: importId },
  );
  const result = data && typeof data === "object" && "result" in data
    ? String(data.result)
    : "";
  if (error || result !== "CONFIRMED") {
    const message = result === "PROFILE_ALREADY_USED" || result === "ALREADY_CONFIRMED"
      ? "Este perfil de importación ya fue confirmado."
      : result === "PROFILE_MISMATCH"
        ? "La tarjeta debe estar publicada, usar puntos acumulativos y contener los hitos 100, 200, 300, 400, 500, 650 y 860."
        : "No se pudo confirmar la importación. Revisa el archivo, la tarjeta y la sucursal.";
    importRedirect({ error: message, importId });
  }
  importRedirect({
    confirmed: "1",
    importId,
    imported: String(data.imported ?? 0),
    duplicates: String(data.duplicates ?? 0),
    errors: String(data.errors ?? 0),
    rewards: String(data.rewards ?? 0),
  });
}
