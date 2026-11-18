"use client";

import { useActionState, useId } from "react";
import { createCampaign } from "@/app/admin/campaigns/actions";
import { FieldError, FormErrorSummary } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/submit-button";
import { CAMPAIGN_LIMITS, type CampaignActionState } from "@/lib/campaigns/form";
import { initialFormState, type FieldErrors } from "@/lib/forms/state";

/** Message step of a new campaign; typed text survives any error (DEC-0073). */
export function CampaignContentForm({ segments, branchId, email, wallet }: { segments: string[]; branchId: string | null; email: number; wallet: number }) {
  const [state, action] = useActionState<CampaignActionState, FormData>(createCampaign, initialFormState({
    name: "", sendEmail: email > 0, emailSubject: "", emailBody: "", sendWallet: wallet > 0, walletMessage: "",
  }));
  const id = useId();
  const errors = state.fieldErrors as FieldErrors;
  const invalid = (field: string) => (errors[field]?.length ? { "aria-invalid": true, "aria-describedby": `${id}-${field}` } : {});
  const values = state.values;
  return <form action={action} className="campaign-content-form" noValidate>
    <FormErrorSummary active={state.status === "error"} fieldErrors={errors} formError={state.formError} title="No se pudo enviar la campaña" />
    {segments.map((segment) => <input key={segment} name="segments" type="hidden" value={segment} />)}
    {branchId ? <input name="branchId" type="hidden" value={branchId} /> : null}
    <label className="field">
      <span>Nombre interno</span>
      <input defaultValue={values.name} maxLength={CAMPAIGN_LIMITS.name} name="name" required {...invalid("name")} />
      <small className="field-hint">Solo lo ve tu equipo, por ejemplo «Recuperar clientes noviembre».</small>
      <FieldError id={`${id}-name`} messages={errors.name} />
    </label>

    <fieldset className="campaign-channel">
      <legend>Correo</legend>
      <label className="check-field">
        <input defaultChecked={values.sendEmail && email > 0} disabled={email === 0} name="sendEmail" type="checkbox" />
        <span>Enviar por correo a {email} {email === 1 ? "cliente" : "clientes"}</span>
      </label>
      <label className="field">
        <span>Asunto</span>
        <input defaultValue={values.emailSubject} maxLength={CAMPAIGN_LIMITS.subject} name="emailSubject" {...invalid("emailSubject")} />
        <FieldError id={`${id}-emailSubject`} messages={errors.emailSubject} />
      </label>
      <label className="field">
        <span>Mensaje</span>
        <textarea defaultValue={values.emailBody} maxLength={CAMPAIGN_LIMITS.body} name="emailBody" rows={6} {...invalid("emailBody")} />
        <small className="field-hint">Hasta 1,500 caracteres. Se agrega un saludo con el nombre del cliente, un botón a su tarjeta y un enlace para darse de baja.</small>
        <FieldError id={`${id}-emailBody`} messages={errors.emailBody} />
      </label>
    </fieldset>

    <fieldset className="campaign-channel">
      <legend>Wallet</legend>
      <label className="check-field">
        <input defaultChecked={values.sendWallet && wallet > 0} disabled={wallet === 0} name="sendWallet" type="checkbox" />
        <span>Enviar aviso a {wallet} {wallet === 1 ? "cliente" : "clientes"} con la tarjeta en Apple Wallet o Google Wallet</span>
      </label>
      <label className="field">
        <span>Aviso</span>
        <input defaultValue={values.walletMessage} maxLength={CAMPAIGN_LIMITS.wallet} name="walletMessage" {...invalid("walletMessage")} />
        <small className="field-hint">Hasta 120 caracteres, sin enlaces. Aparece en la pantalla bloqueada: no incluyas datos personales.</small>
        <FieldError id={`${id}-walletMessage`} messages={errors.walletMessage} />
      </label>
    </fieldset>
    <FieldError id={`${id}-channels`} messages={errors.channels} />

    <label className="check-field">
      <input name="confirmSend" required type="checkbox" {...invalid("confirmSend")} />
      <span>Confirmo el envío: hasta {email} {email === 1 ? "correo" : "correos"} y {wallet} {wallet === 1 ? "aviso" : "avisos"} en Wallet. Una vez enviada, la campaña no se puede cancelar.</span>
    </label>
    <FieldError id={`${id}-confirmSend`} messages={errors.confirmSend} />
    <SubmitButton className="enterprise-primary-action">Enviar campaña</SubmitButton>
  </form>;
}
