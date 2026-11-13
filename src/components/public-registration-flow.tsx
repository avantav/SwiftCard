"use client";

/* Tenant artwork uses validated HTTPS URLs. */
/* eslint-disable @next/next/no-img-element */
import { useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import { registerCustomer, acceptRegistrationTerms, loadRegistrationCard } from "@/app/register/[branchToken]/actions";
import { AppleStoreCardPreview } from "@/components/apple-store-card-preview";
import { PublicRegistrationSuccess } from "@/components/public-registration-success";
import { SubmitButton } from "@/components/submit-button";
import { registrationBrand } from "@/lib/customers/registration-brand";
import type { PublicRegistrationContext } from "@/lib/customers/public-registration-context";
import type { RegistrationState } from "@/lib/customers/registration-state";

export function PublicRegistrationFlow({ branchToken, context }: { branchToken: string; context: PublicRegistrationContext }) {
  const [selectedId, setSelectedId] = useState(context.cards[0].id);
  const [fields, setFields] = useState({ fullName: "", phone: "", email: "", birthDate: "" });
  const [consent, setConsent] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: RegistrationState, formData: FormData) => {
    if (previous.cardToken) {
      return previous.claim && formData.get("intent") !== "reload"
        ? acceptRegistrationTerms(previous.cardToken, previous.claim.program_version, previous, formData)
        : loadRegistrationCard(previous.cardToken);
    }
    return registerCustomer(branchToken, previous, formData);
  }, {} as RegistrationState);
  const resultRef = useRef<HTMLDivElement>(null);
  const selected = context.cards.find((card) => card.id === selectedId) ?? context.cards[0];
  const issued = Boolean(state.cardToken);
  const brand = registrationBrand(selected.design.backgroundColor);
  const brandStyle = {
    "--registration-brand": brand.background,
    "--registration-brand-text": brand.foreground,
  } as CSSProperties;

  useEffect(() => {
    if (state.error || state.cardToken) resultRef.current?.focus();
  }, [state]);

  function updateField(event: React.ChangeEvent<HTMLInputElement>) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  const preview = <div className="registration-preview">
    <AppleStoreCardPreview design={selected.design} tenantName={context.tenantName} programName={selected.programName} programType={state.card?.program_type ?? selected.programType} rewardGoal={state.card?.reward_goal ?? selected.rewardGoal} unitNameSingular={selected.unitNameSingular} unitNamePlural={selected.unitNamePlural} customerName={state.card?.customer_name ?? (fields.fullName.trim() || "Tu nombre")} balance={state.card?.stamp_balance ?? 0} rewardCount={state.card?.available_rewards.length ?? 0} showQr={Boolean(state.qrDataUrl)} qrDataUrl={state.qrDataUrl} />
    <p className="registration-preview-note">{issued ? "Presenta tu QR en las sucursales participantes." : "El diseño puede variar según tu billetera."}</p>
  </div>;

  return <main className="public-registration-shell registration-page" style={brandStyle}>
    <div className="registration-layout">
      <header className="registration-brand">
        {selected.design.logoImageUrl ? <img src={selected.design.logoImageUrl} alt={`Logo de ${context.tenantName}`} /> : <span className="registration-monogram">{context.tenantName}</span>}
        <div ref={resultRef} tabIndex={-1} className="registration-result-focus">
          <h1 id="registration-title">{issued ? "Tu tarjeta está lista" : "Tu tarjeta de lealtad"}</h1>
          <p>{context.branchName} · {context.tenantName}</p>
        </div>
      </header>
      <section className="registration-content" aria-labelledby="registration-title">
        {state.error && !issued ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}
        {issued ? <>
          <div className="registration-issued-card" aria-label="Tu tarjeta digital">{preview}</div>
          <PublicRegistrationSuccess state={state} action={action} pending={pending} />
        </> : <form action={action} className="public-form registration-form" aria-busy={pending}>
          {context.cards.length > 1 ? <label className="field"><span>Tarjeta</span><select name="loyaltyCardId" value={selected.id} disabled={pending} onChange={(event) => { setSelectedId(event.target.value); setConsent(false); }}>
            {context.cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
          </select></label> : <input type="hidden" name="loyaltyCardId" value={selected.id} />}
          <details className="registration-card-peek"><summary>Ver mi tarjeta <span>Vista previa</span></summary>{preview}</details>
          <label className="field"><span>Nombre completo</span><input name="fullName" value={fields.fullName} onChange={updateField} required autoComplete="name" maxLength={160} readOnly={pending} placeholder="¿Cómo te llamas?" /></label>
          <label className="field"><span>Teléfono</span><input name="phone" value={fields.phone} onChange={updateField} required type="tel" inputMode="tel" autoComplete="tel" maxLength={30} readOnly={pending} placeholder="Tu número de celular" /></label>
          <label className="field"><span>Correo electrónico</span><input name="email" value={fields.email} onChange={updateField} required type="email" inputMode="email" autoComplete="email" maxLength={254} readOnly={pending} placeholder="Para avisarte de tus premios" /></label>
          <details className="registration-optional"><summary>Cumpleaños <span>Opcional</span></summary><div>
            <label className="field"><span>Fecha de nacimiento</span><input name="birthDate" value={fields.birthDate} onChange={updateField} type="date" autoComplete="bday" readOnly={pending} /></label>
          </div></details>
          <div className="registration-consent">
            <input id="registration-consent" aria-labelledby="registration-consent-label" name="privacyConsent" type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={pending} />
            <span id="registration-consent-label"><label htmlFor="registration-consent">Acepto los </label><button className="registration-text-button" type="button" aria-expanded={termsOpen} aria-controls="registration-terms" onClick={() => setTermsOpen(!termsOpen)}>términos del programa</button><label htmlFor="registration-consent"> y el </label><button className="registration-text-button" type="button" aria-expanded={privacyOpen} aria-controls="registration-privacy" onClick={() => setPrivacyOpen(!privacyOpen)}>aviso de privacidad</button>.</span>
          </div>
          <section id="registration-terms" className="registration-disclosure" hidden={!termsOpen} aria-label="Términos del programa"><h2>Términos del programa</h2><p tabIndex={0}>{selected.terms}</p></section>
          <section id="registration-privacy" className="registration-disclosure" hidden={!privacyOpen} aria-label="Aviso de privacidad"><h2>Privacidad</h2><p><strong>{context.tenantName}</strong> es responsable de tus datos: nombre, teléfono y correo y, si la compartes, fecha de nacimiento. Los usa para operar tu tarjeta de lealtad, registrar tus compras y premios y enviarte avisos sobre tu tarjeta. Solo te enviará promociones si marcas la casilla correspondiente, y puedes retirar ese permiso cuando quieras. La plataforma morrow los trata por cuenta del negocio. Consulta el <a href="/privacidad/clientes" target="_blank" rel="noopener noreferrer">aviso de privacidad integral</a> para conocer tus derechos y cómo ejercerlos.</p></section>
          <label className="registration-consent">
            <input name="marketingConsent" type="checkbox" disabled={pending} />
            <span>Quiero recibir promociones y novedades de {context.tenantName} por correo, WhatsApp o avisos en mi tarjeta (opcional).</span>
          </label>
          <input type="hidden" name="acceptTerms" value={consent ? "on" : ""} />
          <input type="hidden" name="programVersion" value={selected.programVersion} />
          <SubmitButton className="public-primary-button registration-submit">Crear y guardar mi tarjeta</SubmitButton>
          <p className="registration-fine-print">Disponible en Apple Wallet y Google Wallet</p>
        </form>}
      </section>
      {context.brandingMode !== "WHITE_LABEL" ? <footer className="registration-footer">Powered by <strong>morrow</strong></footer> : null}
    </div>
  </main>;
}
