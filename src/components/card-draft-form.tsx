"use client";

import { useActionState, useId } from "react";
import { createCardDraft, type CardDraftActionState } from "@/app/admin/cards/actions";
import { FieldError, FormErrorSummary } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState, type FieldErrors } from "@/lib/forms/state";

/** Names a new card draft; the dialog keeps the name and shows errors inline (DEC-0073). */
export function CardDraftForm() {
  const [state, action] = useActionState<CardDraftActionState, FormData>(createCardDraft, initialFormState({ name: "" }));
  const id = useId();
  const nameErrors = (state.fieldErrors as FieldErrors).name;
  return <form action={action} className="auth-form card-menu-create-form" noValidate>
    <FormErrorSummary active={state.status === "error" && !nameErrors?.length} formError={state.formError} title="No se pudo crear la tarjeta" />
    <label className="field">
      <span>Nombre de la tarjeta</span>
      <input aria-describedby={`${id}-hint${nameErrors?.length ? ` ${id}-error` : ""}`} aria-invalid={Boolean(nameErrors?.length)} autoFocus defaultValue={state.values.name} maxLength={80} name="name" required />
      <small className="legal-consent-hint" id={`${id}-hint`}>Así la verán tus clientes y tu equipo, por ejemplo «Café diario».</small>
      <FieldError id={`${id}-error`} messages={nameErrors} />
    </label>
    <SubmitButton className="enterprise-primary-action">Crear y configurar</SubmitButton>
  </form>;
}
