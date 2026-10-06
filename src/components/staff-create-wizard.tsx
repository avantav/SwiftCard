"use client";

import { useState } from "react";
import { createStaff } from "@/app/admin/staff/actions";
import { createPinOperator } from "@/app/admin/staff/pin-actions";
import { StaffRoleBranchFields } from "@/components/staff-role-branch-fields";
import { SubmitButton } from "@/components/submit-button";

type BranchOption = {
  id: string;
  name: string;
  employee_access_mode: "INDIVIDUAL_CREDENTIALS" | "SHARED_ACCOUNT_PIN";
};

export function StaffCreateWizard({ branchId, branches, canCreateBranchAdmin, mode }: { branchId: string; branches: BranchOption[]; canCreateBranchAdmin: boolean; mode: "individual" | "pin" }) {
  const [step, setStep] = useState(1);
  const lastStep = mode === "pin" ? 2 : 3;

  return <form action={mode === "pin" ? createPinOperator : createStaff} className="auth-form staff-create-form staff-create-wizard" noValidate>
    {mode === "pin" ? <input name="branchId" type="hidden" value={branchId} /> : null}
    <ol aria-label="Progreso del alta" className="branch-wizard-progress">
      <li className={step === 1 ? "is-current" : "is-complete"}><span>1</span><strong>Identidad</strong></li>
      {mode === "individual" ? <li className={step === 2 ? "is-current" : step > 2 ? "is-complete" : undefined}><span>2</span><strong>Alcance</strong></li> : null}
      <li className={step === lastStep ? "is-current" : undefined}><span>{lastStep}</span><strong>Seguridad</strong></li>
    </ol>

    <section className="branch-wizard-step" hidden={step !== 1}><div className="branch-wizard-step-heading"><h3>Identifica a la persona</h3><p>{mode === "pin" ? "El nombre permite atribuir cada operación dentro de la cuenta compartida." : "Usará estos datos para acceder con su propia cuenta."}</p></div><label className="field"><span>Nombre completo</span><input name="fullName" required /></label>{mode === "individual" ? <label className="field"><span>Correo</span><input name="email" required type="email" /></label> : null}</section>

    {mode === "individual" ? <section className="branch-wizard-step" hidden={step !== 2}><div className="branch-wizard-step-heading"><h3>Define su alcance inicial</h3><p>La persona puede recibir más asignaciones después desde su espacio de administración.</p></div><StaffRoleBranchFields branches={branches} canCreateBranchAdmin={canCreateBranchAdmin} initialBranchId={branchId} /></section> : null}

    <section className="branch-wizard-step" hidden={step !== lastStep}><div className="branch-wizard-step-heading"><h3>Configura el acceso</h3><p>{mode === "pin" ? "El PIN debe tener exactamente seis dígitos y ser único en esta sucursal." : "La contraseña es temporal y deberá cambiarse en el primer ingreso."}</p></div>{mode === "pin" ? <label className="field"><span>PIN de seis dígitos</span><input autoComplete="new-password" inputMode="numeric" maxLength={6} minLength={6} name="pin" pattern="[0-9]{6}" required type="password" /></label> : <><label className="field"><span>Contraseña temporal</span><input maxLength={72} minLength={12} name="temporaryPassword" required type="password" /></label><label className="field"><span>Confirmar contraseña</span><input maxLength={72} minLength={12} name="passwordConfirmation" required type="password" /></label></>}</section>

    <div className="branch-wizard-actions">{step > 1 ? <button className="secondary-button" onClick={() => setStep(step - 1)} type="button">Anterior</button> : <span />}{step < lastStep ? <button className="primary-button" onClick={() => setStep(step + 1)} type="button">Continuar</button> : <SubmitButton>{mode === "pin" ? "Crear usuario PIN" : "Crear cuenta"}</SubmitButton>}</div>
  </form>;
}
