"use client";

import { useRef, useState } from "react";

export type RewardTierEditorValue = {
  id?: string;
  stampsRequired: number | string;
  name: string;
  description: string;
  expirationDays: number | string | null;
};

type EditorTier = RewardTierEditorValue & { key: string };

const emptyTier: RewardTierEditorValue = {
  stampsRequired: 10,
  name: "Recompensa principal",
  description: "Describe claramente el premio que recibirá el cliente.",
  expirationDays: null,
};

export function RewardTiersEditor({ initialTiers }: { initialTiers: RewardTierEditorValue[] }) {
  const nextKey = useRef(1);
  const [tiers, setTiers] = useState<EditorTier[]>(
    (initialTiers.length ? initialTiers : [emptyTier]).map((tier, index) => ({
      ...tier,
      key: tier.id ?? `initial-${index}`,
    })),
  );

  const addTier = () => {
    if (tiers.length >= 10) return;
    const previousStamps = Math.max(
      ...tiers.map((tier) => Number(tier.stampsRequired) || 0),
      0,
    );
    const key = `new-${nextKey.current}`;
    nextKey.current += 1;
    setTiers((current) => [
      ...current,
      {
        key,
        stampsRequired: previousStamps + 5,
        name: "",
        description: "",
        expirationDays: null,
      },
    ]);
  };

  const removeTier = (key: string) => {
    setTiers((current) => current.filter((tier) => tier.key !== key));
  };

  return (
    <div className="reward-tiers-editor">
      <div className="reward-tiers-heading">
        <div>
          <h3>Niveles de recompensa</h3>
          <p>Los niveles pequeños se acumulan. Al completar el nivel con más sellos, inicia un ciclo nuevo y se conserva cualquier sobrante.</p>
        </div>
        <button className="secondary-button" disabled={tiers.length >= 10} onClick={addTier} type="button">Agregar nivel</button>
      </div>
      <p className="sr-only" aria-live="polite">{tiers.length} {tiers.length === 1 ? "nivel configurado" : "niveles configurados"}.</p>
      <ol className="reward-tier-list">
        {tiers.map((tier, index) => (
          <li className="reward-tier-card" key={tier.key}>
            <div className="reward-tier-card-header">
              <div><span>Nivel {index + 1}</span><strong>Premio acumulable</strong></div>
              <button className="reward-tier-remove" disabled={tiers.length === 1} onClick={() => removeTier(tier.key)} type="button">Eliminar</button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Sellos requeridos</span>
                <input name="tierStamps" type="number" min={1} max={1_000_000} defaultValue={tier.stampsRequired} required />
              </label>
              <label className="field">
                <span>Expiración en días</span>
                <input name="tierExpirationDays" type="number" min={1} max={3650} defaultValue={tier.expirationDays ?? ""} placeholder="Sin expiración" />
              </label>
            </div>
            <label className="field">
              <span>Nombre del premio</span>
              <input name="tierName" maxLength={120} defaultValue={tier.name} required />
            </label>
            <label className="field">
              <span>Descripción para la tarjeta</span>
              <textarea name="tierDescription" maxLength={500} defaultValue={tier.description} rows={3} required />
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}
