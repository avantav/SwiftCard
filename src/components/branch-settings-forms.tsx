"use client";

import { useActionState } from "react";
import { configureBranchAccess, configureTenantGeofencing } from "@/app/admin/branches/actions";
import { FormErrorSummary } from "@/components/admin/form-field";
import { BranchAccessFields } from "@/components/branch-access-fields";
import { SubmitButton } from "@/components/submit-button";
import type { BranchAccessActionState, BranchEmployeeAccessMode, GeofencePolicyActionState } from "@/lib/admin/branches";
import { initialFormState, type FieldErrors } from "@/lib/forms/state";

/** Staff sign-in mode of one branch; errors stay inside the dialog (DEC-0073). */
export function BranchAccessForm({ branchId, defaultMode }: { branchId: string; defaultMode: BranchEmployeeAccessMode }) {
  const [state, action] = useActionState<BranchAccessActionState, FormData>(
    configureBranchAccess,
    initialFormState({ employeeAccessMode: defaultMode, sharedEmail: "" }),
  );
  const mode = state.values.employeeAccessMode === "SHARED_ACCOUNT_PIN" ? "SHARED_ACCOUNT_PIN" : state.values.employeeAccessMode === "INDIVIDUAL_CREDENTIALS" ? "INDIVIDUAL_CREDENTIALS" : defaultMode;
  return <form className="auth-form branch-access-form" action={action} noValidate>
    <FormErrorSummary active={state.status === "error"} fieldErrors={state.fieldErrors as FieldErrors} formError={state.formError} title="No se pudo cambiar el acceso" />
    <input type="hidden" name="branchId" value={branchId} />
    <BranchAccessFields compact defaultMode={mode} errors={state.fieldErrors} sharedEmailDefaultValue={state.values.sharedEmail} />
    <SubmitButton className="enterprise-primary-action" confirmMessage="Cambiar el modo revocará las sesiones incompatibles de esta sucursal. ¿Deseas continuar?">Guardar modo de acceso</SubmitButton>
  </form>;
}

/** Tenant-wide GPS policy toggle with inline errors (DEC-0073). */
export function GeofencePolicyForm({ strict, disabled }: { strict: boolean; disabled: boolean }) {
  const target = strict ? "FLEXIBLE" : "STRICT";
  const [state, action] = useActionState<GeofencePolicyActionState, FormData>(configureTenantGeofencing, initialFormState({ locationValidationMode: target }));
  return <form className="branch-policy-action" action={action}>
    <FormErrorSummary active={state.status === "error"} formError={state.formError} title="No se pudo cambiar la política" />
    <input name="locationValidationMode" type="hidden" value={target} />
    <SubmitButton className="enterprise-primary-action" confirmMessage={strict ? "Las operaciones dejarán de validar la distancia. ¿Deseas usar la política flexible?" : "Las compras y canjes fuera del radio serán bloqueados. ¿Deseas activar la validación estricta?"} disabled={disabled}>{strict ? "Cambiar a política flexible" : "Activar política estricta"}</SubmitButton>
  </form>;
}
