"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useId, useRef, useState } from "react";
import { FormErrorSummary } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/submit-button";
import { firstStepWithError, type FieldErrors, type FormState } from "@/lib/forms/state";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  /** Field names owned by this step; a server error on one jumps here. */
  fields: readonly string[];
  /** Client check before "Continuar"; the server validates again on submit. */
  validate?: (formData: FormData) => FieldErrors;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormState = FormState<any, string>;

export type WizardRenderContext<S extends AnyFormState> = {
  state: S;
  /** Server errors merged with the client errors of the current step. */
  errors: FieldErrors;
  step: number;
};

/**
 * Guided multi-step form for creating instances (DEC-0073). Every step stays
 * mounted (inactive ones are `hidden`) so values survive moving back and
 * forth and a failed submit. "Continuar" validates the current step and
 * focuses the first invalid field; a server error returns to the step that
 * owns the field. One primary action per step.
 */
export function WizardForm<S extends AnyFormState>({ steps, action, initialState, submitLabel, errorTitle, cancelHref, children, className = "" }: {
  steps: readonly WizardStep[];
  action: (previous: S, formData: FormData) => Promise<S>;
  initialState: S;
  submitLabel: string;
  errorTitle: string;
  cancelHref: string;
  children: (context: WizardRenderContext<S>) => ReactNode[];
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  const [state, formAction] = useActionState<S, FormData>(async (previous, formData) => {
    const next = await action(previous as S, formData);
    if (next.status === "error") {
      const target = firstStepWithError(next.fieldErrors as FieldErrors, steps.map((item) => item.fields));
      if (target >= 0) setStep(target);
      setClientErrors({});
    }
    return next as Awaited<S>;
  }, initialState as Awaited<S>);

  const errors: FieldErrors = { ...(state.fieldErrors as FieldErrors), ...clientErrors };
  const panels = children({ state, errors, step });
  const last = step === steps.length - 1;

  function focusField(name: string) {
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    field?.focus();
  }

  function validateCurrent() {
    const form = formRef.current;
    const current = steps[step];
    if (!form || !current) return true;
    const found: FieldErrors = { ...(current.validate?.(new FormData(form)) ?? {}) };
    // Native constraints (required, maxLength, type) as a fallback.
    const panel = form.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
    panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((element) => {
      if (!element.name || !element.willValidate || element.checkValidity() || found[element.name]?.length) return;
      found[element.name] = [element.validationMessage];
    });
    const fields = current.fields.filter((field) => found[field]?.length);
    const extra = Object.keys(found).filter((field) => !fields.includes(field) && found[field]?.length);
    setClientErrors(found);
    const firstInvalid = fields[0] ?? extra[0];
    if (firstInvalid) {
      focusField(firstInvalid);
      return false;
    }
    return true;
  }

  function next() {
    if (!validateCurrent()) return;
    setClientErrors({});
    setStep(step + 1);
  }

  return <form
    action={formAction}
    className={`auth-form wizard-form${className ? ` ${className}` : ""}`}
    noValidate
    ref={formRef}
    onKeyDown={(event) => {
      // Enter on an intermediate step continues instead of submitting.
      if (event.key !== "Enter" || last || !(event.target instanceof HTMLInputElement)) return;
      event.preventDefault();
      next();
    }}
  >
    <p className="wizard-step-count" aria-live="polite">Paso {step + 1} de {steps.length}</p>
    <ol className="branch-wizard-progress wizard-progress" data-steps={steps.length} aria-label="Progreso">
      {steps.map((item, index) => <li key={item.id} className={index === step ? "is-current" : index < step ? "is-complete" : undefined} aria-current={index === step ? "step" : undefined}>
        <span>{index + 1}</span><strong>{item.title}</strong>
      </li>)}
    </ol>

    <FormErrorSummary title={errorTitle} formError={state.formError} fieldErrors={state.fieldErrors as FieldErrors} active={state.status === "error"} />

    {steps.map((item, index) => <section
      aria-labelledby={`${id}-step-${index}`}
      className="branch-wizard-step"
      data-wizard-step={index}
      hidden={index !== step}
      key={item.id}
    >
      <div className="branch-wizard-step-heading">
        <h3 id={`${id}-step-${index}`}>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
      </div>
      {panels[index]}
    </section>)}

    <footer className="branch-wizard-actions wizard-actions">
      {step === 0
        ? <Link className="enterprise-secondary-action" href={cancelHref} replace scroll={false}>Cancelar</Link>
        : <button className="enterprise-secondary-action" type="button" onClick={() => { setClientErrors({}); setStep(step - 1); }}>Atrás</button>}
      {last
        ? <SubmitButton className="enterprise-primary-action">{submitLabel}</SubmitButton>
        : <button className="enterprise-primary-action" type="button" onClick={next}>Continuar</button>}
    </footer>
  </form>;
}
