"use client";

import { useEffect, useRef, useState } from "react";

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
  const addedTierRef = useRef<HTMLLIElement>(null);
  const [addedTierKey, setAddedTierKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tiers, setTiers] = useState<EditorTier[]>(
    (initialTiers.length ? initialTiers : [emptyTier]).map((tier, index) => ({
      ...tier,
      key: tier.id ?? `initial-${index}`,
    })),
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set([initialTiers[0]?.id ?? "initial-0"]),
  );

  useEffect(() => {
    if (!addedTierKey || !addedTierRef.current) return;

    addedTierRef.current.scrollIntoView({ block: "nearest" });
    addedTierRef.current
      .querySelector<HTMLInputElement>('input[name="tierStamps"]')
      ?.focus({ preventScroll: true });
  }, [addedTierKey]);

  const addTier = () => {
    if (tiers.length >= 10) return;
    const key = `new-${nextKey.current}`;
    nextKey.current += 1;
    setTiers((current) => {
      if (current.length >= 10) return current;

      const previousStamps = Math.max(
        ...current.map((tier) => Number(tier.stampsRequired) || 0),
        0,
      );

      return [
        ...current,
        {
          key,
          stampsRequired: previousStamps + 5,
          name: "",
          description: "",
          expirationDays: null,
        },
      ];
    });
    setExpandedKeys(new Set([key]));
    setAddedTierKey(key);
    setMessage(`Nivel ${tiers.length + 1} agregado. Completa los datos del premio.`);
  };

  const removeTier = (key: string) => {
    setTiers((current) => current.filter((tier) => tier.key !== key));
    setExpandedKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setAddedTierKey((current) => (current === key ? null : current));
    setMessage("Nivel eliminado.");
  };

  const toggleTier = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const revealInvalidTier = (key: string) => {
    setExpandedKeys((current) => (
      current.has(key) ? current : new Set([...current, key])
    ));
    setMessage("Revisa los datos obligatorios del nivel indicado.");
  };

  const updateTier = <Field extends keyof RewardTierEditorValue>(
    key: string,
    field: Field,
    value: RewardTierEditorValue[Field],
  ) => {
    setTiers((current) => current.map((tier) => (
      tier.key === key ? { ...tier, [field]: value } : tier
    )));
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
      <p className="reward-tiers-status" aria-live="polite">
        {message || `${tiers.length} ${tiers.length === 1 ? "nivel configurado" : "niveles configurados"}.`}
      </p>
      <ol className="reward-tier-list">
        {tiers.map((tier, index) => {
          const expanded = expandedKeys.has(tier.key);
          const fieldsId = `reward-tier-fields-${tier.key}`;
          return (
            <li
              className="reward-tier-card"
              key={tier.key}
              ref={tier.key === addedTierKey ? addedTierRef : undefined}
            >
              <div className="reward-tier-card-header">
                <button
                  aria-controls={fieldsId}
                  aria-expanded={expanded}
                  className="reward-tier-toggle"
                  onClick={() => toggleTier(tier.key)}
                  type="button"
                >
                  <span className="reward-tier-title">
                    <span>Nivel {index + 1}</span>
                    <strong>{tier.name.trim() || "Premio sin nombre"}</strong>
                  </span>
                  <span className="reward-tier-summary">
                    {tier.stampsRequired || 0} {Number(tier.stampsRequired) === 1 ? "sello" : "sellos"} · {expanded ? "Ocultar" : "Editar"}
                  </span>
                </button>
                <button className="reward-tier-remove" disabled={tiers.length === 1} onClick={() => removeTier(tier.key)} type="button">Eliminar</button>
              </div>
              <div className="reward-tier-fields" hidden={!expanded} id={fieldsId}>
                <div className="form-grid">
                  <label className="field">
                    <span>Sellos requeridos</span>
                    <input
                      name="tierStamps"
                      type="number"
                      min={1}
                      max={1_000_000}
                      onChange={(event) => updateTier(tier.key, "stampsRequired", event.target.value)}
                      onInvalid={() => revealInvalidTier(tier.key)}
                      value={tier.stampsRequired}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Expiración en días</span>
                    <input
                      name="tierExpirationDays"
                      type="number"
                      min={1}
                      max={3650}
                      onChange={(event) => updateTier(tier.key, "expirationDays", event.target.value || null)}
                      onInvalid={() => revealInvalidTier(tier.key)}
                      value={tier.expirationDays ?? ""}
                      placeholder="Sin expiración"
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Nombre del premio</span>
                  <input
                    name="tierName"
                    maxLength={120}
                    onChange={(event) => updateTier(tier.key, "name", event.target.value)}
                    onInvalid={() => revealInvalidTier(tier.key)}
                    value={tier.name}
                    required
                  />
                </label>
                <label className="field">
                  <span>Descripción para la tarjeta</span>
                  <textarea
                    name="tierDescription"
                    maxLength={500}
                    onChange={(event) => updateTier(tier.key, "description", event.target.value)}
                    onInvalid={() => revealInvalidTier(tier.key)}
                    value={tier.description}
                    rows={3}
                    required
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
