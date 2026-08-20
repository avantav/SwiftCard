"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createBranch } from "@/app/admin/branches/actions";
import {
  INITIAL_BRANCH_CREATE_STATE,
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
  const [state, action] = useActionState(
    createBranch,
    INITIAL_BRANCH_CREATE_STATE,
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const errors: BranchCreateFieldErrors = state.fieldErrors;
  const fieldMessages = Object.values(errors).flatMap((messages) => messages ?? []);
  const nameErrorId = `${id}-name-error`;
  const proximityHintId = `${id}-proximity-hint`;
  const proximityErrorId = `${id}-proximity-error`;

  useEffect(() => {
    if (state.status === "error") summaryRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="auth-form" noValidate>
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

      <label className="field">
        <span>Nombre</span>
        <input
          aria-describedby={errors.name?.length ? nameErrorId : undefined}
          aria-invalid={Boolean(errors.name?.length)}
          autoComplete="organization"
          defaultValue={state.values.name}
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
        <FieldError id={nameErrorId} messages={errors.name} />
      </label>

      <BranchLocationPicker
        defaultAddress={state.values.address}
        defaultLatitude={state.values.latitude}
        defaultLongitude={state.values.longitude}
        defaultRadius={state.values.geofenceRadiusMeters}
        errors={errors}
      />

      <label className="check-field branch-proximity-field">
        <input
          aria-describedby={describedBy(
            proximityHintId,
            proximityErrorId,
            Boolean(errors.proximityEnabled?.length),
          )}
          aria-invalid={Boolean(errors.proximityEnabled?.length)}
          defaultChecked={state.values.proximityEnabled}
          name="proximityEnabled"
          type="checkbox"
        />
        <span>
          Proximidad habilitada
          <small id={proximityHintId}>
            Requiere coordenadas para generar ubicaciones útiles en Wallet.
          </small>
          <FieldError id={proximityErrorId} messages={errors.proximityEnabled} />
        </span>
      </label>

      <BranchAccessFields
        defaultMode={state.values.employeeAccessMode}
        errors={errors}
        sharedEmailDefaultValue={state.values.sharedEmail}
      />
      <SubmitButton>Crear sucursal</SubmitButton>
    </form>
  );
}
