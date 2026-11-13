"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import {
  parseGlobalModeForm,
  parsePackageModulesForm,
  parseTenantModuleForm,
  safeModulesReturnPath
} from "@/lib/modules/forms";

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

export async function setModuleGlobalMode(formData: FormData) {
  const returnPath = safeModulesReturnPath(String(formData.get("returnTo") ?? ""));
  const parsed = parseGlobalModeForm(formData);
  if (!parsed.ok) back(returnPath, { error: parsed.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(returnPath, { error: "No tienes permisos para administrar módulos." });

  const { data, error } = await context.supabase.schema("app").rpc("set_module_global", {
    target_key: parsed.data.key,
    target_mode: parsed.data.mode,
    target_reason: parsed.data.reason
  });
  if (error || data !== "UPDATED") back(returnPath, { error: "No se pudo actualizar el estado global." });

  revalidatePath("/superadmin/modules");
  back(returnPath, { saved: "global" });
}

export async function setTenantModuleState(formData: FormData) {
  const returnPath = safeModulesReturnPath(String(formData.get("returnTo") ?? ""));
  const parsed = parseTenantModuleForm(formData);
  if (!parsed.ok) back(returnPath, { error: parsed.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(returnPath, { error: "No tienes permisos para administrar módulos." });

  const { data, error } = await context.supabase.schema("app").rpc("set_tenant_module", {
    target_key: parsed.data.key,
    target_tenant_id: parsed.data.tenantId,
    target_state: parsed.data.state,
    target_expires_at: parsed.data.expiresAt,
    target_reason: parsed.data.reason
  });
  if (error || data !== "UPDATED") {
    back(returnPath, { error: data === "NOT_FOUND" ? "El tenant no existe." : "No se pudo guardar el ajuste del tenant." });
  }

  revalidatePath("/superadmin/modules");
  back(returnPath, { saved: "tenant" });
}

export async function setBillingPackageModules(formData: FormData) {
  const packagesPath = "/superadmin/billing/packages";
  const parsed = parsePackageModulesForm(formData);
  if (!parsed.ok) back(packagesPath, { error: parsed.error });
  const context = await getActiveSuperadminContext();
  if (!context) back(packagesPath, { error: "No tienes permisos para administrar paquetes." });

  const { data, error } = await context.supabase.schema("app").rpc("set_billing_package_modules", {
    target_package_id: parsed.data.packageId,
    target_modules: parsed.data.modules,
    target_reason: parsed.data.reason
  });
  if (error || data !== "UPDATED") {
    back(packagesPath, { error: data === "NOT_FOUND" ? "El paquete no existe." : "No se pudieron guardar los módulos del paquete." });
  }

  revalidatePath(packagesPath);
  back(packagesPath, { modules: "saved" });
}
