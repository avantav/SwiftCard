"use client";

import { useId } from "react";
import { createBranch } from "@/app/admin/branches/actions";
import { describedBy, FieldError } from "@/components/admin/form-field";
import { WizardForm, type WizardStep } from "@/components/admin/wizard-form";
import { BranchAccessFields } from "@/components/branch-access-fields";
import { BranchLocationPicker } from "@/components/branch-location-picker";
import {
  BRANCH_CREATE_STEP_FIELDS,
  INITIAL_BRANCH_CREATE_STATE,
  branchCreateStepErrors,
  type BranchCreateFieldErrors,
} from "@/lib/admin/branches";

/** Guided branch creation (DEC-0073): identity, location and access, each validated before continuing. */
export function BranchCreateForm({ supportMode = false }: { supportMode?: boolean }) {
  const id = useId();
  const nameErrorId = `${id}-name-error`;
  const proximityHintId = `${id}-proximity-hint`;
  const proximityErrorId = `${id}-proximity-error`;
  const steps: WizardStep[] = [
    { id: "identity", title: "Identidad", description: "Usa el nombre con el que tu equipo reconoce esta sucursal.", fields: BRANCH_CREATE_STEP_FIELDS[0], validate: (formData) => branchCreateStepErrors(formData, 0) },
    { id: "location", title: "Ubicación", description: "El punto y el radio se reutilizan para GPS y avisos cercanos.", fields: BRANCH_CREATE_STEP_FIELDS[1], validate: (formData) => branchCreateStepErrors(formData, 1) },
    supportMode
      ? { id: "access", title: "Confirmación", description: "El acceso del personal se configura después por un Administrador del tenant.", fields: BRANCH_CREATE_STEP_FIELDS[2] }
      : { id: "access", title: "Acceso", description: "Elige cómo entra el personal. Puedes cambiarlo después desde la administración de la sucursal.", fields: BRANCH_CREATE_STEP_FIELDS[2], validate: (formData) => branchCreateStepErrors(formData, 2) },
  ];

  return <WizardForm
    action={createBranch}
    cancelHref="/admin/branches"
    className="branch-create-wizard"
    errorTitle="No se pudo crear la sucursal"
    initialState={INITIAL_BRANCH_CREATE_STATE}
    steps={steps}
    submitLabel="Crear sucursal"
  >
    {({ state, errors: rawErrors }) => {
      const errors = rawErrors as BranchCreateFieldErrors;
      return [
        <label className="field" key="name">
          <span>Nombre</span>
          <input aria-describedby={errors.name?.length ? nameErrorId : undefined} aria-invalid={Boolean(errors.name?.length)} autoComplete="organization" defaultValue={state.values.name} maxLength={120} minLength={2} name="name" required />
          <FieldError id={nameErrorId} messages={errors.name} />
        </label>,
        <div className="branch-wizard-location" key="location">
          <BranchLocationPicker defaultAddress={state.values.address} defaultLatitude={state.values.latitude} defaultLongitude={state.values.longitude} defaultRadius={state.values.geofenceRadiusMeters} errors={errors} />
          <label className="check-field branch-proximity-field">
            <input aria-describedby={describedBy(proximityHintId, proximityErrorId, Boolean(errors.proximityEnabled?.length))} aria-invalid={Boolean(errors.proximityEnabled?.length)} defaultChecked={state.values.proximityEnabled} name="proximityEnabled" type="checkbox" />
            <span>Activar avisos de proximidad<small id={proximityHintId}>Wallet podrá sugerir la tarjeta cerca de esta ubicación.</small><FieldError id={proximityErrorId} messages={errors.proximityEnabled} /></span>
          </label>
        </div>,
        supportMode
          ? <input key="access" name="employeeAccessMode" type="hidden" value="INDIVIDUAL_CREDENTIALS" />
          : <BranchAccessFields defaultMode={state.values.employeeAccessMode} errors={errors} key="access" sharedEmailDefaultValue={state.values.sharedEmail} />,
      ];
    }}
  </WizardForm>;
}
