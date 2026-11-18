"use client";

import { useEffect, useRef } from "react";
import { fieldErrorMessages, type FieldErrors } from "@/lib/forms/state";

/** Inline error for one control; pair its id with `describedBy`. */
export function FieldError({ id, messages }: { id: string; messages?: string[] | string }) {
  const list = typeof messages === "string" ? [messages] : messages;
  if (!list?.length) return null;
  return <span className="field-error-message" id={id}>{list.join(" ")}</span>;
}

/** `aria-describedby` for a control with an optional hint and error. */
export function describedBy(hintId: string | null, errorId: string, hasError: boolean) {
  return [hintId, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
}

/**
 * Error summary at the top of a form (DESIGN_SYSTEM §12): focused when the
 * submit fails so screen readers announce it, values stay in the fields.
 */
export function FormErrorSummary({ title, formError, fieldErrors, active }: {
  title: string;
  formError?: string | null;
  fieldErrors?: FieldErrors;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const messages = fieldErrors ? fieldErrorMessages(fieldErrors) : [];
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active, formError, messages.length]);
  if (!active || (!formError && !messages.length)) return null;
  return <div className="enterprise-alert is-error form-error-summary" ref={ref} role="alert" tabIndex={-1}>
    <strong>{title}</strong>
    {formError ? <p>{formError}</p> : null}
    {messages.length ? <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul> : null}
  </div>;
}
