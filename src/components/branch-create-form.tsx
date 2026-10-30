"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createBranch } from "@/app/admin/branches/actions";
import {
  INITIAL_BRANCH_CREATE_STATE,
  type BranchCreateActionState,
  type BranchCreateFieldErrors,
} from "@/lib/admin/branches";
import { BranchAccessFields } from "@/components/branch-access-fields";
import { BranchLocationPicker } from "@/components/branch-location-picker";
import { SubmitButton } from "@/components/submit-button";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <span className="field-error-message" id={id}>
      {messages.join(" ")}
    </span>
  );
}

function describedBy(hintId: string | null, errorId: string, hasError: boolean) {
  return [hintId, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
}

export function BranchCreateForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  async function submit(previousState: BranchCreateActionState, formData: FormData) {
    const nextState = await createBranch(previousState, formData);
    if (nextState.status === "error") {
      const locationFields = ["address", "latitude", "longitude", "geofenceRadiusMeters", "proximityEnabled"] as const;
      setStep(nextState.fieldErrors.name?.length ? 1 : locationFields.some((field) => nextState.fieldErrors[field]?.length) ? 2 : 3);
    }
    return nextState;
  }
  const [state, action] = useActionState(submit, INITIAL_BRANCH_CREATE_STATE);
  const summaryRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const errors: BranchCreateFieldErrors = state.fieldErrors;
  const fieldMessages = Object.values(errors).flatMap((messages) => messages ?? []);
  const nameErrorId = `${id}-name-error`;
  const proximityHintId = `${id}-proximity-hint`;
  const proximityErrorId = `${id}-proximity-error`;

  useEffect(() => {
    if (state.status === "error") summaryRef.current?.focus();
  }, [state.status]);

  return (
    <form action={action} className="auth-form branch-create-wizard" noValidate>
      {state.status === "error" ? (
        <div
          className="enterprise-alert is-error branch-validation-summary"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>No se pudo crear la sucursal</strong>
          {state.formError ? <p>{state.formError}</p> : null}
          {fieldMessages.length ? (
            <ul>
              {[...new Set(fieldMessages)].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ol className="branch-wizard-progress" aria-label="Progreso del alta">
        <li className={step === 1 ? "is-current" : step > 1 ? "is-complete" : undefined}><span>1</span><strong>Identidad</strong></li>
        <li className={step === 2 ? "is-current" : step > 2 ? "is-complete" : undefined}><span>2</span><strong>Ubicación</strong></li>
        <li className={step === 3 ? "is-current" : undefined}><span>3</span><strong>Acceso</strong></li>
      </ol>

      <section className="branch-wizard-step" hidden={step !== 1} aria-labelledby={`${id}-identity-title`}>
        <div className="branch-wizard-step-heading"><h3 id={`${id}-identity-title`}>Identifica la ubicación</h3><p>Usa el nombre con el que tu equipo reconoce esta sucursal.</p></div>
        <label className="field">
          <span>Nombre</span>
          <input aria-describedby={errors.name?.length ? nameErrorId : undefined} aria-invalid={Boolean(errors.name?.length)} autoComplete="organization" defaultValue={state.values.name} maxLength={120} minLength={2} name="name" required />
          <FieldError id={nameErrorId} messages={errors.name} />
        </label>
      </section>

      <section className="branch-wizard-step" hidden={step !== 2} aria-labelledby={`${id}-location-title`}>
        <div className="branch-wizard-step-heading"><h3 id={`${id}-location-title`}>Define dónde puede operar</h3><p>El punto y el radio se reutilizan para GPS y avisos cercanos.</p></div>
        <BranchLocationPicker defaultAddress={state.values.address} defaultLatitude={state.values.latitude} defaultLongitude={state.values.longitude} defaultRadius={state.values.geofenceRadiusMeters} errors={errors} />
        <label className="check-field branch-proximity-field">
          <input aria-describedby={describedBy(proximityHintId, proximityErrorId, Boolean(errors.proximityEnabled?.length))} aria-invalid={Boolean(errors.proximityEnabled?.length)} defaultChecked={state.values.proximityEnabled} name="proximityEnabled" type="checkbox" />
          <span>Activar avisos de proximidad<small id={proximityHintId}>Wallet podrá sugerir la tarjeta cerca de esta ubicación.</small><FieldError id={proximityErrorId} messages={errors.proximityEnabled} /></span>
        </label>
      </section>

      <section className="branch-wizard-step" hidden={step !== 3} aria-labelledby={`${id}-access-title`}>
        <div className="branch-wizard-step-heading"><h3 id={`${id}-access-title`}>Elige cómo entra el personal</h3><p>Puedes cambiar este modo después desde la administración de la sucursal.</p></div>
        <BranchAccessFields defaultMode={state.values.employeeAccessMode} errors={errors} sharedEmailDefaultValue={state.values.sharedEmail} />
      </section>

      <div className="branch-wizard-actions">
        {step > 1 ? <button className="secondary-button" onClick={() => setStep(step === 3 ? 2 : 1)} type="button">Anterior</button> : <span />}
        {step < 3 ? <button className="primary-button" onClick={() => setStep(step === 1 ? 2 : 3)} type="button">Continuar</button> : <SubmitButton>Crear sucursal</SubmitButton>}
      </div>
    </form>
  );
}
