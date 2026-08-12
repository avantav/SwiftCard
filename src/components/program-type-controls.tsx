"use client";

import { useState } from "react";

type ProgramType = "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
type ProgramStatus = "ACTIVE" | "PAUSED";

export function ProgramTypeControls({
  hasExistingProgram,
  initialStatus,
  initialType,
}: {
  hasExistingProgram: boolean;
  initialStatus: ProgramStatus;
  initialType: ProgramType;
}) {
  const [programType, setProgramType] = useState(initialType);
  const [status, setStatus] = useState(initialStatus);
  const lifetimePoints = programType === "LIFETIME_POINTS";
  const changingType = hasExistingProgram && programType !== initialType;
  const forcedPaused = lifetimePoints || changingType;

  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>Estado</span>
          <select
            name="status"
            onChange={(event) => setStatus(event.target.value as ProgramStatus)}
            value={forcedPaused ? "PAUSED" : status}
          >
            <option disabled={forcedPaused} value="ACTIVE">Activo</option>
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
              setStatus(nextType === initialType ? initialStatus : "PAUSED");
            }}
            value={programType}
          >
            <option value="STAMPS_PER_PURCHASE">Sellos por compra</option>
            <option value="STAMPS_PER_AMOUNT">Sellos por monto</option>
            <option value="LIFETIME_POINTS">Puntos acumulativos con hitos</option>
          </select>
        </label>
      </div>
      {changingType ? (
        <div
          className="enterprise-alert is-warning program-type-confirmation"
          role="status"
        >
          <p>
            {lifetimePoints
              ? "El programa acumulativo se guardará pausado. Los saldos y recompensas actuales se conservarán para su conversión al activarlo."
              : "El programa se guardará pausado. La nueva regla se aplicará a compras futuras; los saldos, recompensas y movimientos anteriores se conservarán."}
          </p>
          <label className="check-field">
            <input
              name="confirmProgramTypeChange"
              required
              type="checkbox"
              value="1"
            />
            <span>Confirmo el cambio de tipo de programa</span>
          </label>
        </div>
      ) : null}
    </>
  );
}
