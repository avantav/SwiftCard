"use client";

import { useState } from "react";
import { AppleWalletAddButton } from "@/components/apple-wallet-add-button";
import { GoogleWalletAddButton } from "@/components/google-wallet-add-button";
import { SubmitButton } from "@/components/submit-button";
import type { RegistrationState } from "@/lib/customers/registration-state";

export function PublicRegistrationSuccess({ state, action, pending }: { state: RegistrationState; action: (formData: FormData) => void; pending: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [savedLink, setSavedLink] = useState("");
  async function copyCardLink() {
    const url = `${window.location.origin}/card/${encodeURIComponent(state.cardToken!)}`;
    setSavedLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setCopyError(false);
    } catch { setCopyError(true); }
  }
  return <div className="registration-completion">
    <div>
      {state.error ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}
      {state.accepted ? <p className="registration-accepted" role="status">Términos aceptados. Tu tarjeta está lista.</p> : null}
    </div>
    {state.claim && !state.qrDataUrl ? <form action={action} className="public-form"><p role="status">No se pudo cargar el QR. Puedes volver a intentarlo sin repetir tu registro.</p><SubmitButton className="secondary-button" name="intent" value="reload">Volver a cargar el QR</SubmitButton></form> : null}
    {!state.claim ? <form action={action}><SubmitButton className="public-primary-button">Volver a cargar mi tarjeta</SubmitButton></form> : state.accepted ? <>
      <div className="public-wallet-actions">
        {state.appleWalletAvailable ? <AppleWalletAddButton cardToken={state.cardToken!} accepted /> : null}
        {state.googleWalletAvailable ? <GoogleWalletAddButton cardToken={state.cardToken!} accepted /> : null}
      </div>
      {!state.appleWalletAvailable && !state.googleWalletAvailable ? <p className="registration-intro">Puedes usar el QR de esta página como tu tarjeta digital.</p> : <p className="registration-fine-print">La billetera de tu teléfono se abrirá para guardar la tarjeta.</p>}
      <button className="secondary-button registration-save-link" onClick={copyCardLink} type="button">{copied ? "Enlace copiado" : "Copiar enlace de mi tarjeta"}</button>
      {copied ? <p className="registration-fine-print" role="status">Guarda el enlace para volver a abrir tu tarjeta.</p> : null}
      {copyError ? <label className="field"><span>No se pudo copiar. Guarda este enlace:</span><input readOnly value={savedLink} onFocus={(event) => event.currentTarget.select()} /></label> : null}
    </> : <form action={action} className="public-form" aria-busy={pending} key={state.claim.program_version}>
      <details className="registration-terms" open key={state.claim.program_version}><summary>Términos y condiciones</summary><p tabIndex={0} role="region" aria-label="Texto de los términos y condiciones">{state.claim.terms_and_conditions}</p></details>
      <label className="check-field public-check"><input name="acceptTerms" type="checkbox" required disabled={pending} /><span>Acepto los términos y condiciones del programa.</span></label>
      <SubmitButton className="public-primary-button">Aceptar y continuar</SubmitButton>
    </form>}
  </div>;
}
