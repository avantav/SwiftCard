"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { PinUnlockState } from "@/app/app/unlock/actions";
import { SubmitButton } from "@/components/submit-button";

const PIN_LENGTH = 6;
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

type PinPadLoginProps = {
  action: (state: PinUnlockState, formData: FormData) => Promise<PinUnlockState>;
  initialError?: string;
};

function PinKeys({
  locked,
  onAppend,
  onBackspace,
  onClear,
}: {
  locked: boolean;
  onAppend: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const { pending } = useFormStatus();
  const disabled = locked || pending;

  return <div className="operations-pin-keypad" aria-label="Teclado numérico">
    {DIGITS.map((digit) => <button autoFocus={digit === "1"} disabled={disabled} key={digit} onClick={() => onAppend(digit)} type="button">{digit}</button>)}
    <button className="is-action" disabled={disabled} onClick={onClear} type="button">Limpiar</button>
    <button disabled={disabled} onClick={() => onAppend("0")} type="button">0</button>
    <button aria-label="Borrar último dígito" className="is-action" disabled={disabled} onClick={onBackspace} type="button">⌫</button>
  </div>;
}

export function PinPadLogin({ action, initialError }: PinPadLoginProps) {
  const [state, formAction] = useActionState(action, {
    attempt: 0,
    error: null,
    status: "IDLE",
  } satisfies PinUnlockState);

  useEffect(() => {
    if (state.status === "SUCCESS") {
      // A full navigation guarantees that the newly written HttpOnly operator
      // cookie is present before the protected /app tree resolves again.
      window.location.replace("/app");
    }
  }, [state.attempt, state.status]);

  return <PinPadForm
    action={formAction}
    error={state.error ?? (state.attempt === 0 ? initialError : null)}
    key={state.attempt}
    success={state.status === "SUCCESS"}
  />;
}

function PinPadForm({
  action,
  error: initialError,
  success,
}: {
  action: (formData: FormData) => void;
  error?: string | null;
  success: boolean;
}) {
  const [pin, setPin] = useState("");
  const [dismissedInitialError, setDismissedInitialError] = useState(false);

  const append = (digit: string) => {
    setDismissedInitialError(true);
    setPin((current) => current.length < PIN_LENGTH ? `${current}${digit}` : current);
  };
  const backspace = () => {
    setDismissedInitialError(true);
    setPin((current) => current.slice(0, -1));
  };
  const clear = () => {
    setDismissedInitialError(true);
    setPin("");
  };
  const error = !dismissedInitialError ? initialError : null;

  return <form
    action={action}
    className="operations-form operations-pin-form"
    onKeyDown={(event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        append(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Escape") {
        event.preventDefault();
        clear();
      }
    }}
  >
    <input name="pin" type="hidden" value={pin} />
    <div className="operations-pin-entry" aria-label={`${pin.length} de ${PIN_LENGTH} dígitos ingresados`} role="status">
      <span className="operations-pin-label">PIN de seis dígitos</span>
      <div aria-hidden="true" className="operations-pin-dots">
        {Array.from({ length: PIN_LENGTH }, (_, index) => <span className={index < pin.length ? "is-filled" : ""} key={index} />)}
      </div>
      <small>{pin.length} de {PIN_LENGTH} dígitos</small>
    </div>
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    {success ? <p className="operations-alert is-success" role="status">Acceso confirmado. Abriendo el área de operación…</p> : null}
    <PinKeys locked={success} onAppend={append} onBackspace={backspace} onClear={clear} />
    <SubmitButton className="operations-primary-button" disabled={pin.length !== PIN_LENGTH || success}>Entrar</SubmitButton>
  </form>;
}
