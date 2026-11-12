"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { submitSignup, type SignupFormState } from "@/app/signup/actions";

export type SignupPlanOption = {
  code: string;
  name: string;
  monthlyLabel: string;
  yearlyLabel: string | null;
  summary: string;
};

export function SignupForm({
  plans,
  initialPlan,
  initialInterval,
  trialEndsLabel,
}: {
  plans: SignupPlanOption[];
  initialPlan: string;
  initialInterval: "MONTH" | "YEAR";
  trialEndsLabel: string;
}) {
  const [state, action] = useActionState<SignupFormState, FormData>(submitSignup, {
    error: null,
    values: { plan: initialPlan, interval: initialInterval, businessName: "", fullName: "", email: "", phone: "" },
  });
  const [plan, setPlan] = useState(state.values.plan);
  const [interval, setInterval] = useState<"MONTH" | "YEAR">(state.values.interval);
  const selected = plans.find((option) => option.code === plan) ?? plans[0];
  const priceLabel = interval === "YEAR" && selected?.yearlyLabel ? `${selected.yearlyLabel} al año` : `${selected?.monthlyLabel} al mes`;

  return (
    <form action={action} className="public-form" noValidate={false}>
      {state.error ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}

      <fieldset className="public-card-choice">
        <legend>Plan</legend>
        {plans.map((option) => (
          <label key={option.code}>
            <input type="radio" name="plan" value={option.code} checked={plan === option.code} onChange={() => setPlan(option.code)} />
            <span><strong>{option.name} · {option.monthlyLabel}/mes + IVA</strong><small>{option.summary}</small></span>
          </label>
        ))}
      </fieldset>

      <fieldset className="public-card-choice">
        <legend>Forma de pago</legend>
        <label>
          <input type="radio" name="interval" value="MONTH" checked={interval === "MONTH"} onChange={() => setInterval("MONTH")} />
          <span><strong>Mensual</strong><small>Cancela cuando quieras.</small></span>
        </label>
        {selected?.yearlyLabel ? (
          <label>
            <input type="radio" name="interval" value="YEAR" checked={interval === "YEAR"} onChange={() => setInterval("YEAR")} />
            <span><strong>Anual · {selected.yearlyLabel} + IVA</strong><small>Equivale a 2 meses gratis.</small></span>
          </label>
        ) : null}
      </fieldset>

      <label className="field"><span>Nombre del negocio</span><input name="businessName" defaultValue={state.values.businessName} required minLength={2} maxLength={120} autoComplete="organization" /></label>
      <label className="field"><span>Tu nombre completo</span><input name="fullName" defaultValue={state.values.fullName} required minLength={2} maxLength={120} autoComplete="name" /></label>
      <label className="field"><span>Correo</span><input name="email" type="email" defaultValue={state.values.email} required maxLength={254} autoComplete="email" inputMode="email" /><small>Lo usarás para iniciar sesión y recibir tus recibos.</small></label>
      <label className="field"><span>Teléfono <small>(opcional)</small></span><input name="phone" type="tel" defaultValue={state.values.phone} maxLength={30} autoComplete="tel" inputMode="tel" /></label>
      <label className="field"><span>Contraseña</span><input name="password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" /><small>Mínimo 12 caracteres.</small></label>
      <label className="field"><span>Confirma tu contraseña</span><input name="passwordConfirmation" type="password" required minLength={12} maxLength={72} autoComplete="new-password" /></label>

      <div className="sr-only" aria-hidden="true">
        <label>No llenes este campo<input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>

      <label className="check-field"><input name="acceptTerms" type="checkbox" required /><span>Acepto los <a href="/terminos" target="_blank" rel="noopener noreferrer">términos y condiciones del servicio</a> y el <a href="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</a> de morrow, incluida la renovación automática al terminar la prueba.</span></label>

      <p className="public-card-copy">Hoy no se cobra nada. Tu prueba de 30 días termina el {trialEndsLabel}; después se cobran {priceLabel} + IVA con la tarjeta que registres. Puedes cancelar antes sin costo.</p>
      <SubmitButton className="public-primary-button">Continuar al pago seguro</SubmitButton>
    </form>
  );
}
