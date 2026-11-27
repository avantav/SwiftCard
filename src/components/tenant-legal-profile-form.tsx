"use client";

import { useActionState } from "react";
import { updateTenantLegalProfile } from "@/app/legal-consent/actions";
import { SubmitButton } from "@/components/submit-button";
import type { LegalConsentFormState } from "@/lib/legal/consent";

/** Admin general edits the business legal identity (DEC-0072). */
export function TenantLegalProfileForm({ initial }: { initial: { legalName: string; legalAddress: string; legalContactEmail: string } }) {
  const [state, action] = useActionState(updateTenantLegalProfile, {} as LegalConsentFormState);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  return <form action={action} className="legal-profile-form" noValidate>
    {state.error ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}
    <label className="field"><span>Razón social o nombre del titular</span>
      <input name="legalName" defaultValue={values.legalName} required maxLength={200} autoComplete="organization" aria-invalid={errors.legalName ? true : undefined} aria-describedby="profile-name-hint" />
      <small id="profile-name-hint" className={errors.legalName ? "field-error-message" : "legal-consent-hint"}>{errors.legalName ?? "Como aparece en tu constancia de situación fiscal."}</small>
    </label>
    <label className="field"><span>Domicilio completo</span>
      <textarea name="legalAddress" defaultValue={values.legalAddress} required maxLength={400} rows={3} autoComplete="street-address" aria-invalid={errors.legalAddress ? true : undefined} aria-describedby="profile-address-hint" />
      <small id="profile-address-hint" className={errors.legalAddress ? "field-error-message" : "legal-consent-hint"}>{errors.legalAddress ?? "Calle, número, colonia, código postal, ciudad y estado."}</small>
    </label>
    <label className="field"><span>Correo para solicitudes de privacidad <em>Opcional</em></span>
      <input name="legalContactEmail" type="email" inputMode="email" defaultValue={values.legalContactEmail} maxLength={254} autoComplete="email" aria-invalid={errors.legalContactEmail ? true : undefined} aria-describedby="profile-email-hint" />
      <small id="profile-email-hint" className={errors.legalContactEmail ? "field-error-message" : "legal-consent-hint"}>{errors.legalContactEmail ?? "Si lo dejas vacío, se muestra el correo de contacto del negocio."}</small>
    </label>
    <div className="legal-consent-actions"><SubmitButton className="enterprise-primary-action">Guardar datos legales</SubmitButton></div>
  </form>;
}
