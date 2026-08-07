"use client";

import { useState } from "react";
import type { BranchEmployeeAccessMode } from "@/lib/admin/branches";

export function BranchAccessFields({
  defaultMode = "INDIVIDUAL_CREDENTIALS",
  compact = false
}: {
  defaultMode?: BranchEmployeeAccessMode;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<BranchEmployeeAccessMode>(defaultMode);
  const usesPin = mode === "SHARED_ACCOUNT_PIN";

  return <>
    <label className="field"><span>Acceso de usuarios operativos</span><select name="employeeAccessMode" value={mode} onChange={(event) => setMode(event.target.value as BranchEmployeeAccessMode)}><option value="INDIVIDUAL_CREDENTIALS">Correo y contraseña individual</option><option value="SHARED_ACCOUNT_PIN">Cuenta compartida y PIN</option></select></label>
    {usesPin ? <div className="enterprise-subsection"><p className="admin-card-copy">{compact ? "Captura las credenciales para activar o rotar la cuenta común." : "Esta cuenta será la entrada común de los usuarios PIN de la sucursal."}</p><label className="field"><span>Correo compartido</span><input name="sharedEmail" type="email" required /></label><label className="field"><span>{compact ? "Nueva contraseña compartida" : "Contraseña compartida"}</span><input name="sharedPassword" type="password" minLength={12} maxLength={72} required /></label><label className="field"><span>Confirmar contraseña</span><input name="sharedPasswordConfirmation" type="password" minLength={12} maxLength={72} required /></label></div> : null}
  </>;
}
