"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import type { CorrectionState, CustomerProfileState } from "@/app/admin/customers/correction-actions";
import { FieldError, FormErrorSummary } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState, type FieldErrors } from "@/lib/forms/state";

type CorrectionAction = (previous: CorrectionState, formData: FormData) => Promise<CorrectionState>;
type ProfileAction = (previous: CustomerProfileState, formData: FormData) => Promise<CustomerProfileState>;

const idleCorrection = (): CorrectionState => initialFormState({ reason: "", delta: "", branchId: "" });

function ReasonField({ errors, value }: { errors: FieldErrors; value: string }) {
  const id = useId();
  return <label className="field">
    <span>Motivo</span>
    <textarea aria-describedby={`${id}-hint${errors.reason?.length ? ` ${id}-error` : ""}`} aria-invalid={Boolean(errors.reason?.length)} defaultValue={value} maxLength={300} name="reason" required rows={2} />
    <small className="field-hint" id={`${id}-hint`}>Queda en la auditoría junto con tu usuario.</small>
    <FieldError id={`${id}-error`} messages={errors.reason} />
  </label>;
}

/** In-dialog confirmation that names the consequence (DESIGN_SYSTEM §11). */
export function CorrectionConfirmForm({ action, title, consequence, cancelHref, submitLabel }: { action: CorrectionAction; title: string; consequence: string; cancelHref: string; submitLabel: string }) {
  const [state, formAction] = useActionState(action, idleCorrection());
  const errors = state.fieldErrors as FieldErrors;
  return <form action={formAction} className="auth-form customer-correction-confirm" noValidate>
    <div className="enterprise-alert is-warning" role="status"><strong>{title}</strong><p>{consequence}</p></div>
    <FormErrorSummary active={state.status === "error" && !errors.reason?.length} formError={state.formError} title="No se aplicó la corrección" />
    <ReasonField errors={errors} value={state.values.reason} />
    <div className="customer-correction-actions">
      <Link className="enterprise-secondary-action" href={cancelHref} replace scroll={false}>Volver sin cambios</Link>
      <SubmitButton className="danger-button">{submitLabel}</SubmitButton>
    </div>
  </form>;
}

/** Adds or removes stamps at one of the card's branches. */
export function AdjustStampsForm({ action, branches, unitPlural }: { action: CorrectionAction; branches: { id: string; name: string }[]; unitPlural: string }) {
  const [state, formAction] = useActionState(action, idleCorrection());
  const errors = state.fieldErrors as FieldErrors;
  const id = useId();
  return <form action={formAction} className="auth-form customer-adjust-form" noValidate>
    <FormErrorSummary active={state.status === "error"} fieldErrors={errors} formError={state.formError} title="No se aplicó el ajuste" />
    <fieldset className="customer-adjust-direction">
      <legend>Tipo de ajuste</legend>
      <label className="check-field"><input defaultChecked name="direction" type="radio" value="add" /><span>Agregar {unitPlural}</span></label>
      <label className="check-field"><input name="direction" type="radio" value="remove" /><span>Quitar {unitPlural}</span></label>
    </fieldset>
    <div className="form-grid">
      <label className="field"><span>Cantidad</span><input aria-describedby={errors.delta?.length ? `${id}-delta` : undefined} aria-invalid={Boolean(errors.delta?.length)} defaultValue={state.values.delta} inputMode="numeric" max={100} min={1} name="delta" required type="number" /><FieldError id={`${id}-delta`} messages={errors.delta} /></label>
      <label className="field"><span>Sucursal</span><select aria-describedby={errors.branchId?.length ? `${id}-branch` : undefined} aria-invalid={Boolean(errors.branchId?.length)} defaultValue={state.values.branchId || branches[0]?.id || ""} name="branchId" required>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select><FieldError id={`${id}-branch`} messages={errors.branchId} /></label>
    </div>
    <ReasonField errors={errors} value={state.values.reason} />
    <SubmitButton className="enterprise-primary-action" confirmMessage="El ajuste cambia el saldo del cliente y queda en su historial. ¿Deseas aplicarlo?">Aplicar ajuste</SubmitButton>
  </form>;
}

/** Contact data and status of the customer. */
export function CustomerProfileForm({ action, initial }: { action: ProfileAction; initial: CustomerProfileState["values"] }) {
  const [state, formAction] = useActionState(action, initialFormState(initial));
  const errors = state.fieldErrors as FieldErrors;
  const id = useId();
  const field = (name: keyof CustomerProfileState["values"]) => ({
    "aria-describedby": errors[name]?.length ? `${id}-${name}` : undefined,
    "aria-invalid": Boolean(errors[name]?.length),
    defaultValue: state.values[name],
    name,
  });
  return <form action={formAction} className="auth-form customer-profile-form" noValidate>
    <FormErrorSummary active={state.status === "error"} fieldErrors={errors} formError={state.formError} title="No se guardó el cliente" />
    <label className="field"><span>Nombre completo</span><input autoComplete="off" maxLength={160} required {...field("fullName")} /><FieldError id={`${id}-fullName`} messages={errors.fullName} /></label>
    <div className="form-grid">
      <label className="field"><span>Teléfono</span><input inputMode="tel" maxLength={30} required type="tel" {...field("phone")} /><FieldError id={`${id}-phone`} messages={errors.phone} /></label>
      <label className="field"><span>Correo <em className="field-optional">Opcional</em></span><input inputMode="email" maxLength={254} type="email" {...field("email")} /><FieldError id={`${id}-email`} messages={errors.email} /></label>
    </div>
    <div className="form-grid">
      <label className="field"><span>Fecha de nacimiento <em className="field-optional">Opcional</em></span><input type="date" {...field("birthDate")} /><FieldError id={`${id}-birthDate`} messages={errors.birthDate} /></label>
      <label className="field"><span>Estado</span><select {...field("status")}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
    </div>
    <SubmitButton className="enterprise-primary-action">Guardar cliente</SubmitButton>
  </form>;
}
