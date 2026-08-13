"use client";

import { useState } from "react";

export function CardProgramFields({
  amountPerStamp,
  initialType,
  minimumPurchase,
  stampsPerPurchase,
}: {
  amountPerStamp: string;
  initialType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT";
  minimumPurchase: string;
  stampsPerPurchase: number;
}) {
  const [type, setType] = useState(initialType);
  return (
    <>
      <label className="field">
        <span>Cómo se obtienen los sellos</span>
        <select
          name="programType"
          onChange={(event) => setType(event.target.value as typeof type)}
          value={type}
        >
          <option value="STAMPS_PER_PURCHASE">Por compra o visita</option>
          <option value="STAMPS_PER_AMOUNT">Por monto gastado</option>
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
      ) : (
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
      )}
    </>
  );
}
