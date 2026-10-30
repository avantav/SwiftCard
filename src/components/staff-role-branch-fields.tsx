"use client";

import { useState } from "react";

type BranchOption = {
  id: string;
  name: string;
  employee_access_mode: "INDIVIDUAL_CREDENTIALS" | "SHARED_ACCOUNT_PIN";
};

export function StaffRoleBranchFields({
  branches,
  canCreateBranchAdmin,
  initialBranchId = "",
}: {
  branches: BranchOption[];
  canCreateBranchAdmin: boolean;
  initialBranchId?: string;
}) {
  const [role, setRole] = useState<"MANAGER" | "EMPLOYEE">("EMPLOYEE");
  const [branchId, setBranchId] = useState(initialBranchId);
  const availableBranches = role === "MANAGER"
    ? branches
    : branches.filter((branch) => branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS");

  return <>
    <label className="field"><span>Rol</span><select name="role" value={role} onChange={(event) => {
      const nextRole = event.target.value as "MANAGER" | "EMPLOYEE";
      setRole(nextRole);
      if (nextRole === "EMPLOYEE" && !branches.some((branch) => branch.id === branchId && branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS")) setBranchId("");
    }}><option value="EMPLOYEE">Empleado</option>{canCreateBranchAdmin ? <option value="MANAGER">Administrador de sucursal</option> : null}</select></label>
    <label className="field"><span>Sucursal inicial</span><select name="branchId" required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Selecciona una sucursal</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{role === "EMPLOYEE" && availableBranches.length === 0 ? <small>No hay sucursales con cuentas individuales disponibles.</small> : null}</label>
  </>;
}
