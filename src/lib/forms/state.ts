/**
 * Shared form contract for administrative server actions (DEC-0073).
 *
 * Actions validate, call the RPC, map its codes to field or form errors and
 * RETURN this state, so the client keeps what the person typed and the dialog
 * stays open. They redirect only on success or from the auth/legal guards.
 */
import type { NoticeCode } from "@/lib/forms/notices";

export type FieldErrors<K extends string = string> = Partial<Record<K, string[]>>;

export type FormState<V extends object, K extends string = Extract<keyof V, string>> = {
  status: "idle" | "error" | "success";
  formError: string | null;
  fieldErrors: FieldErrors<K>;
  values: V;
  /** Success toast shown by the admin ToastRegion. */
  notice?: NoticeCode;
};

export type ValidationResult<T, K extends string = string> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: FieldErrors<K>; formError?: string };

export function initialFormState<V extends object>(values: V): FormState<V> {
  return { status: "idle", formError: null, fieldErrors: {}, values };
}

export function errorState<V extends object, K extends string = Extract<keyof V, string>>(
  values: V,
  fieldErrors: FieldErrors<K>,
  formError: string | null = null,
): FormState<V, K> {
  return { status: "error", formError, fieldErrors, values };
}

export function successState<V extends object>(values: V, notice?: NoticeCode): FormState<V> {
  return { status: "success", formError: null, fieldErrors: {}, values, notice };
}

/** Support sessions are read-only unless an action explicitly allows it. */
export function supportReadOnlyState<V extends object>(values: V): FormState<V> {
  return errorState(values, {}, "El modo soporte es de solo lectura para esta acción.");
}

/** Reads trimmed string values; missing keys become "". */
export function readValues<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value.trim() : "";
  }
  return values;
}

export function hasFieldErrors(errors: FieldErrors) {
  return Object.values(errors).some((messages) => Boolean(messages?.length));
}

/** Unique messages in field order, for the error summary. */
export function fieldErrorMessages(errors: FieldErrors) {
  return [...new Set(Object.values(errors).flatMap((messages) => messages ?? []))];
}

/** Index of the first wizard step that owns a field with an error, or -1. */
export function firstStepWithError(errors: FieldErrors, steps: readonly (readonly string[])[]) {
  return steps.findIndex((fields) => fields.some((field) => errors[field]?.length));
}
