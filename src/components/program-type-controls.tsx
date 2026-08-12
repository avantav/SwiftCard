"use client";

import { useState } from "react";

type ProgramType = "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
type ProgramStatus = "ACTIVE" | "PAUSED";

export function ProgramTypeControls({
  initialStatus,
  initialType,
}: {
  initialStatus: ProgramStatus;
  initialType: ProgramType;
}) {
  const [programType, setProgramType] = useState(initialType);
  const [status, setStatus] = useState(initialStatus);
  const lifetimePoints = programType === "LIFETIME_POINTS";

  return (
    <div className="form-grid">
      <label className="field">
        <span>Estado</span>
        <select
          name="status"
          onChange={(event) => setStatus(event.target.value as ProgramStatus)}
          value={lifetimePoints ? "PAUSED" : status}
        >
          <option disabled={lifetimePoints} value="ACTIVE">Activo</option>
          <option value="PAUSED">Pausado</option>
        </select>
      </label>
      <label className="field">
        <span>Tipo de programa</span>
        <select
          name="programType"
          onChange={(event) => {
            const nextType = event.target.value as ProgramType;
            setProgramType(nextType);
            if (nextType === "LIFETIME_POINTS") setStatus("PAUSED");
          }}
          value={programType}
        >
          <option value="STAMPS_PER_PURCHASE">Sellos por compra</option>
          <option value="STAMPS_PER_AMOUNT">Sellos por monto</option>
          <option value="LIFETIME_POINTS">Puntos acumulativos con hitos</option>
        </select>
      </label>
    </div>
  );
}
