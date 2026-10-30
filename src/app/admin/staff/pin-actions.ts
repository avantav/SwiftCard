"use server";

import { redirect } from "next/navigation";
import { isSixDigitPin } from "@/lib/auth/pin-session";
import { requireInternalArea } from "@/lib/auth/server";

function staffUrl(values: Record<string, string>) {
  return `/admin/staff?${new URLSearchParams(values)}`;
}

function back(error: string, branchId = ""): never {
  redirect(staffUrl({ ...(branchId ? { branch: branchId } : {}), error }));
}

export async function createPinOperator(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const pin = formData.get("pin");
  if (!branchId || !fullName || !isSixDigitPin(pin)) back("Nombre, sucursal y PIN de seis dígitos son obligatorios.", branchId);
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("create_branch_pin_operator", {
    target_branch_id: branchId,
    target_full_name: fullName,
    target_pin: pin
  });
  if (error || data === "INVALID") back("Los datos del usuario PIN no son válidos.", branchId);
  if (data === "DUPLICATE_PIN") back("Ese PIN ya está asignado en la sucursal.", branchId);
  if (data !== "CREATED") back("No tienes acceso para crear usuarios en esa sucursal.", branchId);
  redirect(staffUrl({ branch: branchId, pinCreated: "1" }));
}

export async function resetPinOperator(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const returnBranch = String(formData.get("returnBranch") ?? "").trim();
  const pin = formData.get("pin");
  if (!operatorId || !isSixDigitPin(pin)) back("Ingresa un PIN nuevo de seis dígitos.", returnBranch);
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("reset_branch_pin_operator", {
    target_operator_id: operatorId,
    target_pin: pin
  });
  if (error || data === "DUPLICATE_PIN") back(data === "DUPLICATE_PIN" ? "Ese PIN ya está asignado." : "No se pudo restablecer el PIN.", returnBranch);
  if (data !== "RESET") back("No tienes acceso a ese usuario PIN.", returnBranch);
  redirect(staffUrl({ ...(returnBranch ? { branch: returnBranch } : {}), pinUpdated: "1" }));
}

export async function setPinOperatorStatus(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const returnBranch = String(formData.get("returnBranch") ?? "").trim();
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("set_branch_pin_operator_status", {
    target_operator_id: operatorId,
    target_status: status
  });
  if (error || data !== "UPDATED") back("No se pudo cambiar el estado del usuario PIN.", returnBranch);
  redirect(staffUrl({ ...(returnBranch ? { branch: returnBranch } : {}), pinUpdated: "1" }));
}

export async function clearPinLockout(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("clear_branch_pin_lockout", {
    target_branch_id: branchId
  });
  if (error || data !== "CLEARED") back("No se pudo desbloquear el acceso PIN.", branchId);
  redirect(staffUrl({ branch: branchId, lockCleared: "1" }));
}
