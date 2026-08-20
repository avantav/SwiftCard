"use client";

import { useState } from "react";

export function CardProgramFields({
  amountPerStamp,
  initialType,
  minimumPurchase,
  stampsPerPurchase,
}: {
  amountPerStamp: string;
  initialType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  minimumPurchase: string;
  stampsPerPurchase: number;
}) {
  const [type, setType] = useState(initialType);
  return (
    <>
      <label className="field">
        <span>Cómo se acumula el progreso</span>
        <select
          name="programType"
          onChange={(event) => setType(event.target.value as typeof type)}
          value={type}
        >
          <option value="STAMPS_PER_PURCHASE">Por compra o visita</option>
          <option value="STAMPS_PER_AMOUNT">Por monto gastado</option>
          <option value="LIFETIME_POINTS">Puntos acumulativos sin reinicio</option>
        </select>
      </label>
      {type === "STAMPS_PER_PURCHASE" ? (
        <div className="form-grid">
          <label className="field">
            <span>Monto mínimo de compra</span>
            <input defaultValue={minimumPurchase} min="0" name="minimumPurchase" step="0.01" type="number" required />
          </label>
          <label className="field">
            <span>Sellos por compra</span>
            <input defaultValue={stampsPerPurchase} min="1" max="1000000" name="stampsPerPurchase" type="number" required />
          </label>
        </div>
      ) : type === "STAMPS_PER_AMOUNT" ? (
        <div className="form-grid">
          <label className="field">
            <span>Monto por sello</span>
            <input defaultValue={amountPerStamp} min="0.01" name="amountPerStamp" step="0.01" type="number" required />
          </label>
          <label className="check-field card-wizard-check">
            <input defaultChecked name="carryRemainder" type="checkbox" />
            <span>Conservar el remanente para la siguiente compra</span>
          </label>
        </div>
      ) : (
        <div className="admin-form-section">
          <label className="field">
            <span>Monto entero por punto</span>
            <input
              defaultValue={String(Number(amountPerStamp))}
              min="1"
              name="pointsAmount"
              step="1"
              type="number"
              required
            />
            <small>La compra se trunca a un decimal. La fracción descartada no se traslada a otra compra.</small>
          </label>
          <p className="enterprise-alert is-info">
            El saldo nunca se reinicia y cada hito entrega su recompensa una sola vez.
          </p>
        </div>
      )}
      {type !== initialType ? (
        <label className="check-field card-wizard-check">
          <input name="confirmProgramTypeChange" type="checkbox" required />
          <span>Confirmo el cambio de tipo. Se conservarán el historial y las recompensas; el saldo vigente se convertirá al nuevo programa.</span>
        </label>
      ) : null}
    </>
  );
}
