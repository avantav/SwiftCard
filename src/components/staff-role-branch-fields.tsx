"use client";

import { useState } from "react";

type BranchOption = {
  id: string;
  name: string;
  employee_access_mode: "INDIVIDUAL_CREDENTIALS" | "SHARED_ACCOUNT_PIN";
};

export function StaffRoleBranchFields({
  branches,
  canCreateBranchAdmin
}: {
  branches: BranchOption[];
  canCreateBranchAdmin: boolean;
}) {
  const [role, setRole] = useState<"MANAGER" | "EMPLOYEE">("EMPLOYEE");
  const availableBranches = role === "MANAGER"
    ? branches
    : branches.filter((branch) => branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS");

  return <>
    <label className="field"><span>Rol</span><select name="role" value={role} onChange={(event) => setRole(event.target.value as "MANAGER" | "EMPLOYEE")}><option value="EMPLOYEE">Empleado</option>{canCreateBranchAdmin ? <option value="MANAGER">Administrador de sucursal</option> : null}</select></label>
    <label className="field"><span>Sucursal inicial</span><select name="branchId" required defaultValue=""><option value="">Selecciona una sucursal</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{role === "EMPLOYEE" && availableBranches.length === 0 ? <small>No hay sucursales con cuentas individuales disponibles.</small> : null}</label>
  </>;
}
