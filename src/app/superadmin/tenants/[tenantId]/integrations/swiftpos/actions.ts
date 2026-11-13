"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { generateApiKey } from "@/lib/integrations/swiftpos/api-key";
import { parseBranchLinkForm, parseLimitsForm, parseReasonForm } from "@/lib/integrations/swiftpos/admin-forms";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pagePath(tenantId: string) {
  return `/superadmin/tenants/${tenantId}/integrations/swiftpos`;
}

function back(tenantId: string, params: Record<string, string>): never {
  redirect(`${pagePath(tenantId)}?${new URLSearchParams(params).toString()}`);
}

function tenantIdFrom(formData: FormData): string {
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!UUID_PATTERN.test(tenantId)) redirect("/superadmin?error=Datos+de+tenant+inválidos");
  return tenantId;
}

export type IssueKeyState = { key?: string; prefix?: string; error?: string };

/** Generates the key on the server and returns it once; only its hash is stored. */
export async function issueIntegrationKey(_previous: IssueKeyState, formData: FormData): Promise<IssueKeyState> {
  const tenantId = tenantIdFrom(formData);
  const reason = parseReasonForm(formData);
  if (!reason.ok) return { error: reason.error };
  const context = await getActiveSuperadminContext();
  if (!context) return { error: "No tienes permisos para administrar integraciones." };

  const generated = generateApiKey();
  const { data, error } = await context.supabase.schema("app").rpc("issue_integration_key", {
    target_tenant_id: tenantId,
    target_key_prefix: generated.prefix,
    target_key_hash: generated.hash,
    target_reason: reason.data
  });
  if (error || data !== "ISSUED") {
    return {
      error: data === "TOO_MANY_KEYS"
        ? "Ya hay dos llaves activas. Revoca una antes de emitir otra."
        : "No se pudo emitir la llave."
    };
  }
  revalidatePath(pagePath(tenantId));
  return { key: generated.key, prefix: generated.prefix };
}

export async function revokeIntegrationKey(formData: FormData) {
  const tenantId = tenantIdFrom(formData);
  const keyId = String(formData.get("keyId") ?? "");
  const reason = parseReasonForm(formData);
  if (!UUID_PATTERN.test(keyId) || !reason.ok) back(tenantId, { error: reason.ok ? "La llave no es válida." : reason.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(tenantId, { error: "No tienes permisos para administrar integraciones." });
  const { data, error } = await context.supabase.schema("app").rpc("revoke_integration_key", {
    target_key_id: keyId,
    target_reason: reason.data
  });
  if (error || data !== "REVOKED") back(tenantId, { error: "No se pudo revocar la llave." });
  revalidatePath(pagePath(tenantId));
  back(tenantId, { saved: "revoked" });
}

export async function saveIntegrationBranchLink(formData: FormData) {
  const tenantId = tenantIdFrom(formData);
  const parsed = parseBranchLinkForm(formData);
  if (!parsed.ok) back(tenantId, { error: parsed.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(tenantId, { error: "No tienes permisos para administrar integraciones." });
  const { data, error } = await context.supabase.schema("app").rpc("set_integration_branch_link", {
    target_tenant_id: tenantId,
    target_external_store_id: parsed.data.storeId,
    target_branch_id: parsed.data.branchId,
    target_reason: parsed.data.reason
  });
  if (error || data !== "UPDATED") back(tenantId, { error: "No se pudo guardar la sucursal vinculada." });
  revalidatePath(pagePath(tenantId));
  back(tenantId, { saved: parsed.data.branchId ? "link" : "unlink" });
}

export async function saveIntegrationLimits(formData: FormData) {
  const tenantId = tenantIdFrom(formData);
  const parsed = parseLimitsForm(formData);
  if (!parsed.ok) back(tenantId, { error: parsed.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(tenantId, { error: "No tienes permisos para administrar integraciones." });
  const { data, error } = await context.supabase.schema("app").rpc("set_integration_limits", {
    target_tenant_id: tenantId,
    target_max_amount_minor: parsed.data.maxAmountMinor,
    target_max_per_hour: parsed.data.maxPerHour,
    target_max_per_day: parsed.data.maxPerDay,
    target_reason: parsed.data.reason
  });
  if (error || data !== "UPDATED") back(tenantId, { error: "No se pudieron guardar los límites." });
  revalidatePath(pagePath(tenantId));
  back(tenantId, { saved: "limits" });
}
