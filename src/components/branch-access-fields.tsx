"use client";

import { useId, useState } from "react";
import type {
  BranchCreateFieldErrors,
  BranchEmployeeAccessMode,
} from "@/lib/admin/branches";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <span className="field-error-message" id={id}>
      {messages.join(" ")}
    </span>
  );
}

export function BranchAccessFields({
  defaultMode = "INDIVIDUAL_CREDENTIALS",
  compact = false,
  errors = {},
  sharedEmailDefaultValue = "",
}: {
  defaultMode?: BranchEmployeeAccessMode;
  compact?: boolean;
  errors?: BranchCreateFieldErrors;
  sharedEmailDefaultValue?: string;
}) {
  const [mode, setMode] = useState<BranchEmployeeAccessMode>(defaultMode);
  const usesPin = mode === "SHARED_ACCOUNT_PIN";
  const id = useId();
  const modeErrorId = `${id}-mode-error`;
  const emailErrorId = `${id}-email-error`;
  const passwordErrorId = `${id}-password-error`;
  const confirmationErrorId = `${id}-confirmation-error`;

  return (
    <>
      <label className="field">
        <span>Acceso de usuarios operativos</span>
        <select
          aria-describedby={errors.employeeAccessMode?.length ? modeErrorId : undefined}
          aria-invalid={Boolean(errors.employeeAccessMode?.length)}
          name="employeeAccessMode"
          onChange={(event) =>
            setMode(event.target.value as BranchEmployeeAccessMode)
          }
          required
          value={mode}
        >
          <option value="INDIVIDUAL_CREDENTIALS">
            Correo y contraseña individual
          </option>
          <option value="SHARED_ACCOUNT_PIN">Cuenta compartida y PIN</option>
        </select>
        <FieldError id={modeErrorId} messages={errors.employeeAccessMode} />
      </label>
      {usesPin ? (
        <div className="enterprise-subsection">
          <p className="admin-card-copy">
            {compact
              ? "Captura las credenciales para activar o rotar la cuenta común."
              : "Esta cuenta será la entrada común de los usuarios PIN de la sucursal."}
          </p>
          <label className="field">
            <span>Correo compartido</span>
            <input
              aria-describedby={errors.sharedEmail?.length ? emailErrorId : undefined}
              aria-invalid={Boolean(errors.sharedEmail?.length)}
              autoComplete="username"
              defaultValue={sharedEmailDefaultValue}
              maxLength={254}
              name="sharedEmail"
              required
              type="email"
            />
            <FieldError id={emailErrorId} messages={errors.sharedEmail} />
          </label>
          <label className="field">
            <span>{compact ? "Nueva contraseña compartida" : "Contraseña compartida"}</span>
            <input
              aria-describedby={errors.sharedPassword?.length ? passwordErrorId : undefined}
              aria-invalid={Boolean(errors.sharedPassword?.length)}
              autoComplete="new-password"
              maxLength={72}
              minLength={12}
              name="sharedPassword"
              required
              type="password"
            />
            <span className="field-hint">Entre 12 y 72 caracteres.</span>
            <FieldError id={passwordErrorId} messages={errors.sharedPassword} />
          </label>
          <label className="field">
            <span>Confirmar contraseña</span>
            <input
              aria-describedby={
                errors.sharedPasswordConfirmation?.length
                  ? confirmationErrorId
                  : undefined
              }
              aria-invalid={Boolean(errors.sharedPasswordConfirmation?.length)}
              autoComplete="new-password"
              maxLength={72}
              minLength={12}
              name="sharedPasswordConfirmation"
              required
              type="password"
            />
            <FieldError
              id={confirmationErrorId}
              messages={errors.sharedPasswordConfirmation}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
