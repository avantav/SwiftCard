"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { signOut } from "@/app/logout/actions";
import { changePinOperator } from "@/app/app/unlock/actions";
import { SubmitButton } from "@/components/submit-button";
import type { LegalConsentFormState, LegalConsentStatus } from "@/lib/legal/consent";

type ConsentAction = (previous: LegalConsentFormState, formData: FormData) => Promise<LegalConsentFormState>;

/**
 * Blocking acceptance of the platform legal documents (DEC-0072). The page
 * behind it is not rendered; the dialog cannot be dismissed and only offers
 * accepting, signing out or, on shared devices, switching PIN operator.
 */
export function LegalConsentGate({ status, action, operatorName }: { status: LegalConsentStatus; action: ConsentAction; operatorName?: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(action, {});
  const business = status.canEditCompany;
  const values = state.values ?? {
    legalName: status.legalName ?? "",
    legalAddress: status.legalAddress ?? "",
    legalContactEmail: status.legalContactEmail ?? status.contactEmail ?? "",
  };
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.setAttribute("closedby", "none");
    const preventDismissal = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", preventDismissal);
    if (!dialog.open) dialog.showModal();

    return () => dialog.removeEventListener("cancel", preventDismissal);
  }, []);

  const title = business
    ? status.companyInfoRequired ? "Completa los datos legales de tu negocio" : "Acepta los términos actualizados"
    : "Antes de continuar";

  return <dialog
    ref={dialogRef}
    className="legal-consent-dialog"
    aria-labelledby="legal-consent-title"
    aria-describedby="legal-consent-description"
  >
    <form action={formAction} className="legal-consent-form" noValidate>
      <header>
        <p className="enterprise-breadcrumb">{business ? `Admin general · ${status.tenantName}` : status.tenantName}</p>
        <h2 id="legal-consent-title">{title}</h2>
        <p id="legal-consent-description">{business
          ? "La razón social y el domicilio aparecen como responsable en los términos y el aviso de privacidad que ven tus clientes al registrarse. Después acepta, en nombre del negocio, los términos de SwiftyCards."
          : `${operatorName ? `${operatorName}, para` : "Para"} usar SwiftyCards en ${status.tenantName} acepta los términos y condiciones de la app y revisa su aviso de privacidad.`}</p>
      </header>

      {state.error ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}

      {business ? <div className="legal-consent-fields">
        <label className="field"><span>Razón social o nombre del titular</span>
          <input name="legalName" defaultValue={values.legalName} required maxLength={200} autoComplete="organization" aria-invalid={state.fieldErrors?.legalName ? true : undefined} aria-describedby="legal-name-hint" />
          <small id="legal-name-hint" className={state.fieldErrors?.legalName ? "field-error-message" : "legal-consent-hint"}>{state.fieldErrors?.legalName ?? "Como aparece en tu constancia de situación fiscal."}</small>
        </label>
        <label className="field"><span>Domicilio completo</span>
          <textarea name="legalAddress" defaultValue={values.legalAddress} required maxLength={400} rows={3} autoComplete="street-address" aria-invalid={state.fieldErrors?.legalAddress ? true : undefined} aria-describedby="legal-address-hint" />
          <small id="legal-address-hint" className={state.fieldErrors?.legalAddress ? "field-error-message" : "legal-consent-hint"}>{state.fieldErrors?.legalAddress ?? "Calle, número, colonia, código postal, ciudad y estado."}</small>
        </label>
        <label className="field"><span>Correo para solicitudes de privacidad <em>Opcional</em></span>
          <input name="legalContactEmail" type="email" inputMode="email" defaultValue={values.legalContactEmail} maxLength={254} autoComplete="email" aria-invalid={state.fieldErrors?.legalContactEmail ? true : undefined} aria-describedby="legal-email-hint" />
          <small id="legal-email-hint" className={state.fieldErrors?.legalContactEmail ? "field-error-message" : "legal-consent-hint"}>{state.fieldErrors?.legalContactEmail ?? "Tus clientes lo usarán para ejercer sus derechos sobre sus datos."}</small>
        </label>
      </div> : null}

      <label className="check-field legal-consent-check">
        <input name="acceptLegal" type="checkbox" required aria-invalid={state.fieldErrors?.acceptLegal ? true : undefined} />
        <span>{business ? `Acepto, en nombre de ${status.tenantName}, los ` : "Acepto los "}<a href="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones del Servicio</a> y he leído el <a href="/privacidad" target="_blank" rel="noopener noreferrer">Aviso de Privacidad</a> de SwiftyCards.</span>
      </label>
      {state.fieldErrors?.acceptLegal ? <p className="field-error-message">{state.fieldErrors.acceptLegal}</p> : null}

      <input type="hidden" name="returnTo" value={returnTo} />
      <footer className="legal-consent-actions">
        {operatorName ? <button type="submit" formAction={changePinOperator} formNoValidate className="enterprise-secondary-action">Cambiar de operador</button> : <button type="submit" formAction={signOut} formNoValidate className="enterprise-secondary-action">Cerrar sesión</button>}
        <SubmitButton className="enterprise-primary-action">{business ? "Guardar y continuar" : "Aceptar y continuar"}</SubmitButton>
      </footer>
    </form>
  </dialog>;
}
