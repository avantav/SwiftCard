"use server";

import { redirect } from "next/navigation";
import { isSixDigitPin } from "@/lib/auth/pin-session";
import { requireInternalArea } from "@/lib/auth/server";
import { validatePinOperatorForm, type StaffCreateActionState } from "@/lib/admin/staff";
import { withNotice, type NoticeCode } from "@/lib/forms/notices";
import { errorState, hasFieldErrors } from "@/lib/forms/state";

function staffUrl(values: Record<string, string>) {
  return `/admin/staff?${new URLSearchParams(values)}`;
}

/** Same branch, operator and section as the dialog that submitted (DEC-0073). */
function dialogUrl(formData: FormData, extra: Record<string, string> = {}) {
  const values: Record<string, string> = {};
  for (const key of ["returnBranch", "returnPin", "returnSection"] as const) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) values[key.replace("return", "").toLowerCase()] = value;
  }
  return staffUrl({ ...values, ...extra });
}

function backWithError(formData: FormData, error: string): never {
  redirect(dialogUrl(formData, { error }));
}

function backWithNotice(formData: FormData, notice: NoticeCode): never {
  redirect(withNotice(dialogUrl(formData), notice));
}

export async function createPinOperator(_previousState: StaffCreateActionState, formData: FormData): Promise<StaffCreateActionState> {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const pin = formData.get("pin");
  const values = { fullName, email: "", role: "EMPLOYEE", branchId };
  const fieldErrors = validatePinOperatorForm(formData);
  if (!branchId || hasFieldErrors(fieldErrors) || !isSixDigitPin(pin)) {
    return errorState(values, fieldErrors, "Nombre, sucursal y PIN de seis dígitos son obligatorios.");
  }
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("create_branch_pin_operator", {
    target_branch_id: branchId,
    target_full_name: fullName,
    target_pin: pin
  });
  if (error || data === "INVALID") return errorState(values, {}, "Los datos del usuario PIN no son válidos.");
  if (data === "DUPLICATE_PIN") return errorState(values, { pin: ["Ese PIN ya está asignado en la sucursal. Elige otro."] }, "Ese PIN ya está asignado en la sucursal.");
  if (data !== "CREATED") return errorState(values, {}, "No tienes acceso para crear usuarios en esa sucursal.");
  redirect(withNotice(staffUrl({ branch: branchId }), "pin_operator_created"));
}

export async function resetPinOperator(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const pin = formData.get("pin");
  if (!operatorId || !isSixDigitPin(pin)) backWithError(formData, "Ingresa un PIN nuevo de seis dígitos.");
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("reset_branch_pin_operator", {
    target_operator_id: operatorId,
    target_pin: pin
  });
  if (error || data === "DUPLICATE_PIN") backWithError(formData, data === "DUPLICATE_PIN" ? "Ese PIN ya está asignado." : "No se pudo restablecer el PIN.");
  if (data !== "RESET") backWithError(formData, "No tienes acceso a ese usuario PIN.");
  backWithNotice(formData, "staff_updated");
}

export async function setPinOperatorStatus(formData: FormData) {
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "INACTIVE";
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("set_branch_pin_operator_status", {
    target_operator_id: operatorId,
    target_status: status
  });
  if (error || data !== "UPDATED") backWithError(formData, "No se pudo cambiar el estado del usuario PIN.");
  backWithNotice(formData, "staff_updated");
}

export async function clearPinLockout(formData: FormData) {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const context = await requireInternalArea("ADMIN", { writable: true });
  const { data, error } = await context.supabase.schema("app").rpc("clear_branch_pin_lockout", {
    target_branch_id: branchId
  });
  if (error || data !== "CLEARED") backWithError(formData, "No se pudo desbloquear el acceso PIN.");
  backWithNotice(formData, "staff_updated");
}
