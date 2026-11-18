"use client";

import { useId, type InputHTMLAttributes } from "react";
import { createStaff } from "@/app/admin/staff/actions";
import { createPinOperator } from "@/app/admin/staff/pin-actions";
import { FieldError } from "@/components/admin/form-field";
import { WizardForm, type WizardStep } from "@/components/admin/wizard-form";
import { StaffRoleBranchFields } from "@/components/staff-role-branch-fields";
import {
  PIN_OPERATOR_STEP_FIELDS,
  STAFF_CREATE_STEP_FIELDS,
  pinOperatorStepErrors,
  staffCreateStepErrors,
} from "@/lib/admin/staff";
import { initialFormState, type FieldErrors } from "@/lib/forms/state";

type BranchOption = {
  id: string;
  name: string;
  employee_access_mode: "INDIVIDUAL_CREDENTIALS" | "SHARED_ACCOUNT_PIN";
};

function Field({ label, name, errors, ...input }: { label: string; name: string; errors: FieldErrors } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const messages = errors[name];
  return <label className="field">
    <span>{label}</span>
    <input aria-describedby={messages?.length ? id : undefined} aria-invalid={Boolean(messages?.length)} name={name} {...input} />
    <FieldError id={id} messages={messages} />
  </label>;
}

/** Guided staff creation (DEC-0073): every step validated before continuing. */
export function StaffCreateWizard({ branchId, branches, canCreateBranchAdmin, mode }: { branchId: string; branches: BranchOption[]; canCreateBranchAdmin: boolean; mode: "individual" | "pin" }) {
  const cancelHref = `/admin/staff?branch=${encodeURIComponent(branchId)}`;
  const initialState = initialFormState({ fullName: "", email: "", role: "EMPLOYEE", branchId });

  if (mode === "pin") {
    const steps: WizardStep[] = [
      { id: "identity", title: "Identidad", description: "El nombre permite atribuir cada operación dentro de la cuenta compartida.", fields: PIN_OPERATOR_STEP_FIELDS[0], validate: (formData) => pinOperatorStepErrors(formData, 0) },
      { id: "security", title: "Seguridad", description: "El PIN debe tener exactamente seis dígitos y ser único en esta sucursal.", fields: PIN_OPERATOR_STEP_FIELDS[1], validate: (formData) => pinOperatorStepErrors(formData, 1) },
    ];
    return <WizardForm key="pin" action={createPinOperator} cancelHref={cancelHref} className="staff-create-form staff-create-wizard" errorTitle="No se pudo crear el usuario PIN" initialState={initialState} steps={steps} submitLabel="Crear usuario PIN">
      {({ state, errors }) => [
        <div key="identity"><input name="branchId" type="hidden" value={branchId} /><Field autoComplete="name" defaultValue={state.values.fullName} errors={errors} label="Nombre completo" maxLength={160} name="fullName" required /></div>,
        <Field autoComplete="new-password" errors={errors} inputMode="numeric" key="security" label="PIN de seis dígitos" maxLength={6} minLength={6} name="pin" pattern="[0-9]{6}" required type="password" />,
      ]}
    </WizardForm>;
  }

  const steps: WizardStep[] = [
    { id: "identity", title: "Identidad", description: "Usará estos datos para acceder con su propia cuenta.", fields: STAFF_CREATE_STEP_FIELDS[0], validate: (formData) => staffCreateStepErrors(formData, 0) },
    { id: "scope", title: "Alcance", description: "La persona puede recibir más asignaciones después desde su espacio de administración.", fields: STAFF_CREATE_STEP_FIELDS[1], validate: (formData) => staffCreateStepErrors(formData, 1) },
    { id: "security", title: "Seguridad", description: "La contraseña es temporal y deberá cambiarse en el primer ingreso.", fields: STAFF_CREATE_STEP_FIELDS[2], validate: (formData) => staffCreateStepErrors(formData, 2) },
  ];
  return <WizardForm key="individual" action={createStaff} cancelHref={cancelHref} className="staff-create-form staff-create-wizard" errorTitle="No se pudo crear la cuenta" initialState={initialState} steps={steps} submitLabel="Crear cuenta">
    {({ state, errors }) => [
      <div className="wizard-fields" key="identity">
        <Field autoComplete="name" defaultValue={state.values.fullName} errors={errors} label="Nombre completo" maxLength={160} name="fullName" required />
        <Field autoComplete="email" defaultValue={state.values.email} errors={errors} inputMode="email" label="Correo" maxLength={254} name="email" required type="email" />
      </div>,
      <StaffRoleBranchFields branches={branches} canCreateBranchAdmin={canCreateBranchAdmin} errors={errors} initialBranchId={state.values.branchId || branchId} initialRole={state.values.role === "MANAGER" && canCreateBranchAdmin ? "MANAGER" : "EMPLOYEE"} key="scope" />,
      <div className="wizard-fields" key="security">
        <Field autoComplete="new-password" errors={errors} label="Contraseña temporal" maxLength={72} minLength={12} name="temporaryPassword" required type="password" />
        <Field autoComplete="new-password" errors={errors} label="Confirmar contraseña" maxLength={72} minLength={12} name="passwordConfirmation" required type="password" />
      </div>,
    ]}
  </WizardForm>;
}
