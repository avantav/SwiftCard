"use server";

import { redirect } from "next/navigation";
import { correctionResultMessage, validateReason } from "@/lib/admin/customer-activity";
import { requireInternalArea } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/customers/phone";
import { withNotice } from "@/lib/forms/notices";
import { errorState, type FieldErrors, type FormState } from "@/lib/forms/state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CorrectionState = FormState<{ reason: string; delta: string; branchId: string }, "reason" | "delta" | "branchId">;
export type CustomerProfileState = FormState<{ fullName: string; phone: string; email: string; birthDate: string; status: string }>;

const CORRECTION_RPCS = {
  "cancel-purchase": { rpc: "cancel_purchase", target: "target_purchase_id", ok: "CANCELLED" },
  "reverse-redemption": { rpc: "reverse_reward_redemption", target: "target_redemption_id", ok: "REVERSED" },
  "cancel-reward": { rpc: "cancel_reward", target: "target_reward_id", ok: "CANCELLED" },
} as const;

type CorrectionKind = keyof typeof CORRECTION_RPCS;

/** Admin general only; support sessions are read-only (DEC-0074). */
async function requireCorrectionAdmin() {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  return context;
}

function historyHref(customerId: string) {
  return withNotice(`/admin/customers?customer=${encodeURIComponent(customerId)}&ctab=historial`, "correction_saved");
}

/**
 * Cancels a purchase, reverses a redemption or cancels a reward. The RPCs
 * re-check tenant, role, state and program options; errors keep the reason.
 */
export async function applyCorrection(customerId: string, kind: CorrectionKind, targetId: string, _previous: CorrectionState, formData: FormData): Promise<CorrectionState> {
  const values = { reason: String(formData.get("reason") ?? "").trim(), delta: "", branchId: "" };
  const fail = (formError: string, fieldErrors: FieldErrors<"reason" | "delta" | "branchId"> = {}) =>
    errorState<CorrectionState["values"], "reason" | "delta" | "branchId">(values, fieldErrors, formError);
  if (!UUID.test(customerId) || !UUID.test(targetId) || !(kind in CORRECTION_RPCS)) return fail("El movimiento no es válido.");
  const reason = validateReason(formData.get("reason"));
  if (!reason.ok) return fail(reason.error, { reason: [reason.error] });
  const context = await requireCorrectionAdmin();
  const spec = CORRECTION_RPCS[kind];
  const { data, error } = await context.supabase.schema("app").rpc(spec.rpc, { [spec.target]: targetId, target_reason: reason.reason });
  if (error || data !== spec.ok) return fail(correctionResultMessage(typeof data === "string" ? data : null, error?.code));
  redirect(historyHref(customerId));
}

/** Adds or removes stamps with a reason; lifetime points are refused by the database. */
export async function adjustCustomerStamps(customerId: string, _previous: CorrectionState, formData: FormData): Promise<CorrectionState> {
  const values = {
    reason: String(formData.get("reason") ?? "").trim(),
    delta: String(formData.get("delta") ?? "").trim(),
    branchId: String(formData.get("branchId") ?? "").trim(),
  };
  const fieldErrors: FieldErrors<"reason" | "delta" | "branchId"> = {};
  const amount = Number(values.delta);
  const direction = formData.get("direction") === "remove" ? -1 : 1;
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) fieldErrors.delta = ["Escribe una cantidad entera de 1 a 100."];
  if (!UUID.test(values.branchId)) fieldErrors.branchId = ["Elige la sucursal donde se registra el ajuste."];
  const reason = validateReason(formData.get("reason"));
  if (!reason.ok) fieldErrors.reason = [reason.error];
  if (!UUID.test(customerId) || Object.keys(fieldErrors).length || !reason.ok) {
    return errorState<CorrectionState["values"], "reason" | "delta" | "branchId">(values, fieldErrors, "Revisa los datos del ajuste.");
  }
  const context = await requireCorrectionAdmin();
  const { data, error } = await context.supabase.schema("app").rpc("adjust_customer_stamps", {
    target_customer_id: customerId,
    target_branch_id: values.branchId,
    target_stamps_delta: direction * amount,
    target_reason: reason.reason,
  });
  if (error || data !== "ADJUSTED") {
    return errorState<CorrectionState["values"], "reason" | "delta" | "branchId">(values, {}, correctionResultMessage(typeof data === "string" ? data : null, error?.code));
  }
  redirect(historyHref(customerId));
}

/** Edits contact data and status; the phone stays unique per tenant. */
export async function updateCustomerProfileFromAdmin(customerId: string, _previous: CustomerProfileState, formData: FormData): Promise<CustomerProfileState> {
  const values = {
    fullName: String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    status: formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
  const fieldErrors: FieldErrors<keyof typeof values> = {};
  if (!values.fullName || values.fullName.length > 160) fieldErrors.fullName = ["Escribe el nombre completo."];
  const phone = normalizePhone(values.phone);
  if (!phone.ok) fieldErrors.phone = [phone.error];
  if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) fieldErrors.email = ["El correo no es válido."];
  if (values.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate)) fieldErrors.birthDate = ["La fecha de nacimiento no es válida."];
  if (!UUID.test(customerId) || Object.keys(fieldErrors).length || !phone.ok) return errorState(values, fieldErrors, "Revisa los datos del cliente.");
  const context = await requireCorrectionAdmin();
  const { data, error } = await context.supabase.schema("app").rpc("update_customer_profile", {
    target_customer_id: customerId,
    target_full_name: values.fullName,
    target_normalized_phone: phone.value,
    target_email: values.email,
    target_birth_date: values.birthDate || null,
    target_status: values.status,
  });
  if (error || data === "DUPLICATE") return errorState(values, { phone: ["Ese teléfono ya está registrado en otro cliente."] }, "No se pudo guardar el cliente.");
  if (data !== "UPDATED") return errorState(values, {}, "No tienes acceso a ese cliente.");
  redirect(withNotice(`/admin/customers?customer=${encodeURIComponent(customerId)}&ctab=resumen`, "customer_updated"));
}
