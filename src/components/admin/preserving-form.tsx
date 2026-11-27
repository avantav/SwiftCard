"use client";

import { createContext, type ReactNode, startTransition, useActionState, useContext } from "react";
import { FormErrorSummary } from "@/components/admin/form-field";
import type { FieldErrors, FormState } from "@/lib/forms/state";

const PendingContext = createContext(false);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormState = FormState<any, string>;

/**
 * Form for long editors whose fields keep their own client state (DEC-0073).
 * Unlike `<form action>`, it never resets the inputs after the action, so a
 * server error leaves everything the admin typed in place. Native constraint
 * validation still runs before submitting; the submitter's name/value (e.g.
 * `intent=exit`) is sent with the data, and a child that prevents the native
 * submit (an image still uploading) keeps blocking it.
 */
export function PreservingForm<S extends AnyFormState>({ action, initialState, errorTitle, className = "auth-form", children }: {
  action: (previous: S, formData: FormData) => Promise<S>;
  initialState: S;
  errorTitle: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState<S, FormData>(
    async (previous, formData) => (await action(previous as S, formData)) as Awaited<S>,
    initialState as Awaited<S>,
  );
  return <form
    aria-busy={pending}
    className={className}
    onSubmit={(event) => {
      // A child may veto the submit first (e.g. an image still uploading).
      const vetoed = event.nativeEvent.defaultPrevented;
      event.preventDefault();
      if (pending || vetoed) return;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const formData = new FormData(event.currentTarget, submitter);
      startTransition(() => dispatch(formData));
    }}
  >
    <FormErrorSummary active={state.status === "error"} fieldErrors={state.fieldErrors as FieldErrors} formError={state.formError} title={errorTitle} />
    <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
  </form>;
}

/** Submit button for PreservingForm: disabled with a clear label while saving. */
export function PreservingSubmit({ children, className = "enterprise-primary-action", name, value, disabled = false }: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const pending = useContext(PendingContext);
  return <button aria-busy={pending} className={className} disabled={pending || disabled} name={name} type="submit" value={value}>
    {pending ? <><span aria-hidden="true" className="enterprise-spinner" />Guardando…</> : children}
  </button>;
}
