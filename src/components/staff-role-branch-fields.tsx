"use client";

import { useId, useState } from "react";
import { FieldError } from "@/components/admin/form-field";
import type { FieldErrors } from "@/lib/forms/state";

type BranchOption = {
  id: string;
  name: string;
  employee_access_mode: "INDIVIDUAL_CREDENTIALS" | "SHARED_ACCOUNT_PIN";
};

export function StaffRoleBranchFields({
  branches,
  canCreateBranchAdmin,
  initialBranchId = "",
  initialRole = "EMPLOYEE",
  errors = {},
}: {
  branches: BranchOption[];
  canCreateBranchAdmin: boolean;
  initialBranchId?: string;
  initialRole?: "MANAGER" | "EMPLOYEE";
  errors?: FieldErrors;
}) {
  const [role, setRole] = useState<"MANAGER" | "EMPLOYEE">(initialRole);
  const [branchId, setBranchId] = useState(initialBranchId);
  const id = useId();
  const availableBranches = role === "MANAGER"
    ? branches
    : branches.filter((branch) => branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS");

  return <div className="wizard-fields">
    <label className="field"><span>Rol</span><select aria-describedby={errors.role?.length ? `${id}-role` : undefined} aria-invalid={Boolean(errors.role?.length)} name="role" value={role} onChange={(event) => {
      const nextRole = event.target.value as "MANAGER" | "EMPLOYEE";
      setRole(nextRole);
      if (nextRole === "EMPLOYEE" && !branches.some((branch) => branch.id === branchId && branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS")) setBranchId("");
    }}><option value="EMPLOYEE">Empleado</option>{canCreateBranchAdmin ? <option value="MANAGER">Administrador de sucursal</option> : null}</select><FieldError id={`${id}-role`} messages={errors.role} /></label>
    <label className="field"><span>Sucursal inicial</span><select aria-describedby={errors.branchId?.length ? `${id}-branch` : undefined} aria-invalid={Boolean(errors.branchId?.length)} name="branchId" required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Selecciona una sucursal</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{role === "EMPLOYEE" && availableBranches.length === 0 ? <small>No hay sucursales con cuentas individuales disponibles.</small> : null}<FieldError id={`${id}-branch`} messages={errors.branchId} /></label>
  </div>;
}
