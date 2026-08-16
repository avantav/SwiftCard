/* Tenant logos use validated remote HTTPS URLs that cannot be statically allowlisted. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { CSSProperties } from "react";
import { AppleWalletAddButton } from "@/components/apple-wallet-add-button";
import { SubmitButton } from "@/components/submit-button";

export type CustomerCardClaimData = {
  customer_name: string;
  logo_url: string | null;
  primary_color: string;
  program_name: string;
  program_version: number;
  secondary_color: string;
  tenant_name: string;
  terms_and_conditions: string;
};

export function CustomerCardClaim({
  accepted,
  action,
  appleWalletAvailable,
  card,
  cardToken,
  error,
}: {
  accepted: boolean;
  action: (formData: FormData) => void | Promise<void>;
  appleWalletAvailable: boolean;
  card: CustomerCardClaimData;
  cardToken: string;
  error?: string;
}) {
  const style = {
    "--claim-primary": card.primary_color,
    "--claim-secondary": card.secondary_color,
  } as CSSProperties;

  return <main className="public-shell customer-claim-shell" style={style}>
    <section className="public-card customer-claim-card" aria-labelledby="claim-title">
      <header className="customer-claim-header">
        {card.logo_url ? <img alt={`Logo de ${card.tenant_name}`} src={card.logo_url} /> : <span aria-hidden="true">{card.tenant_name.slice(0, 2).toUpperCase()}</span>}
        <div><p>{card.tenant_name}</p><small>{card.program_name}</small></div>
      </header>
      <div className="customer-claim-body"><p className="public-eyebrow">Tu tarjeta está lista</p><h1 id="claim-title">{card.customer_name}</h1><p>Revisa las condiciones y agrega tu tarjeta digital desde esta pantalla.</p>
        {error ? <p className="enterprise-alert is-error" role="alert">{error}</p> : null}
        <section className="customer-claim-terms" aria-labelledby="claim-terms-title"><h2 id="claim-terms-title">Términos y condiciones</h2><p>{card.terms_and_conditions}</p></section>
        {accepted ? <div className="customer-claim-accepted"><p role="status">Términos aceptados.</p>{appleWalletAvailable ? <AppleWalletAddButton cardToken={cardToken} accepted /> : <Link className="public-primary-button" href={`/card/${encodeURIComponent(cardToken)}`}>Abrir mi tarjeta digital</Link>}</div> : <form action={action} className="customer-claim-form">
          <label className="check-field public-check"><input name="acceptTerms" type="checkbox" required /><span>Acepto los términos y condiciones vigentes del programa.</span></label>
          <SubmitButton className="public-primary-button">{appleWalletAvailable ? "Aceptar y agregar a Apple Wallet" : "Aceptar y abrir mi tarjeta"}</SubmitButton>
        </form>}
        <Link className="customer-claim-later" href={`/card/${encodeURIComponent(cardToken)}`}>Ver la tarjeta sin agregarla ahora</Link>
      </div>
    </section>
  </main>;
}
