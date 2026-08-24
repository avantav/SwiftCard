"use client";

import { useState } from "react";

export function WelcomeRewardFields({
  initialDescription,
  initialEnabled,
  initialExpirationDays,
  initialName,
}: {
  initialDescription: string;
  initialEnabled: boolean;
  initialExpirationDays: number | null;
  initialName: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return <section className="admin-form-section card-welcome-reward" aria-labelledby="welcome-reward-title">
    <input name="configurationOptionsPresent" type="hidden" value="1" />
    <div className="card-section-heading">
      <div>
        <h3 id="welcome-reward-title">Regalo de bienvenida</h3>
        <p>Opcional. Se entrega una sola vez cuando se crea un cliente, sin descontar puntos ni reiniciar su saldo.</p>
      </div>
      <label className="check-field card-wizard-check">
        <input checked={enabled} name="welcomeRewardEnabled" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
        <span>Activar</span>
      </label>
    </div>
    <fieldset className="card-welcome-reward-fields" disabled={!enabled} hidden={!enabled}>
      <div className="form-grid">
        <label className="field"><span>Nombre del regalo</span><input defaultValue={initialName} maxLength={120} name="welcomeRewardName" required /></label>
        <label className="field"><span>Vigencia en días <small>(opcional)</small></span><input defaultValue={initialExpirationDays ?? ""} max={3650} min={1} name="welcomeRewardExpirationDays" type="number" /></label>
      </div>
      <label className="field"><span>Descripción</span><textarea defaultValue={initialDescription} maxLength={500} name="welcomeRewardDescription" required rows={3} /></label>
    </fieldset>
  </section>;
}
