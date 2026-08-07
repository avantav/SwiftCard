"use server";

import { redirect } from "next/navigation";
import { isSixDigitPin } from "@/lib/auth/pin-session";
import { requireInternalArea } from "@/lib/auth/server";

function back(error: string): never {
  redirect(`/admin/staff?error=${encodeURIComponent(error)}`);
}

export async function createPinOperator(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const pin = formData.get("pin");
  if (!branchId || !fullName || !isSixDigitPin(pin)) back("Nombre, sucursal y PIN de seis dígitos son obligatorios.");
  const context = await requireInternalArea("ADMIN");
  const { data, error } = await context.supabase.schema("app").rpc("create_branch_pin_operator", {
    target_branch_id: branchId,
    target_full_name: fullName,
    target_pin: pin
  });
  if (error || data === "INVALID") back("Los datos del usuario PIN no son válidos.");
  if (data === "DUPLICATE_PIN") back("Ese PIN ya está asignado en la sucursal.");
  if (data !== "CREATED") back("No tienes acceso para crear usuarios en esa sucursal.");
  redirect("/admin/staff?pinCreated=1");
}

export async function resetPinOperator(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const pin = formData.get("pin");
  if (!operatorId || !isSixDigitPin(pin)) back("Ingresa un PIN nuevo de seis dígitos.");
  const context = await requireInternalArea("ADMIN");
  const { data, error } = await context.supabase.schema("app").rpc("reset_branch_pin_operator", {
    target_operator_id: operatorId,
    target_pin: pin
  });
  if (error || data === "DUPLICATE_PIN") back(data === "DUPLICATE_PIN" ? "Ese PIN ya está asignado." : "No se pudo restablecer el PIN.");
  if (data !== "RESET") back("No tienes acceso a ese usuario PIN.");
  redirect("/admin/staff?pinUpdated=1");
}

export async function setPinOperatorStatus(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";
  const context = await requireInternalArea("ADMIN");
  const { data, error } = await context.supabase.schema("app").rpc("set_branch_pin_operator_status", {
    target_operator_id: operatorId,
    target_status: status
  });
  if (error || data !== "UPDATED") back("No se pudo cambiar el estado del usuario PIN.");
  redirect("/admin/staff?pinUpdated=1");
}

export async function clearPinLockout(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const context = await requireInternalArea("ADMIN");
  const { data, error } = await context.supabase.schema("app").rpc("clear_branch_pin_lockout", {
    target_branch_id: branchId
  });
  if (error || data !== "CLEARED") back("No se pudo desbloquear el acceso PIN.");
  redirect("/admin/staff?lockCleared=1");
}
