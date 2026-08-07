"use client";

/* Tenant images are explicit HTTPS design inputs and are previewed before saving. */
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";
import { saveAppleWalletDesign } from "@/app/admin/wallet/actions";
import { SubmitButton } from "@/components/submit-button";

export type AppleWalletDesignValues = {
  appleEnabled: boolean;
  logoText: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoImageUrl: string;
  stripImageUrl: string;
};

export function AppleWalletDesignForm({
  initial,
}: {
  initial: AppleWalletDesignValues;
}) {
  const [design, setDesign] = useState(initial);
  const update = <Key extends keyof AppleWalletDesignValues>(
    key: Key,
    value: AppleWalletDesignValues[Key],
  ) => setDesign((current) => ({ ...current, [key]: value }));
  const previewStyle = {
    "--apple-pass-background": design.backgroundColor,
    "--apple-pass-foreground": design.foregroundColor,
    "--apple-pass-label": design.labelColor,
  } as CSSProperties;

  return (
    <div className="apple-wallet-editor">
      <form className="auth-form apple-wallet-form" action={saveAppleWalletDesign}>
        <label className="check-field apple-wallet-enable">
          <input
            checked={design.appleEnabled}
            name="appleEnabled"
            onChange={(event) => update("appleEnabled", event.target.checked)}
            type="checkbox"
          />
          <span>Permitir que los clientes descarguen la tarjeta</span>
        </label>

        <div className="admin-form-section">
          <h2 className="section-title">Identidad</h2>
          <label className="field">
            <span>Texto junto al logo</span>
            <input
              maxLength={60}
              name="logoText"
              onChange={(event) => update("logoText", event.target.value)}
              required
              value={design.logoText}
            />
          </label>
          <label className="field">
            <span>Descripción del pase</span>
            <input
              maxLength={120}
              name="description"
              onChange={(event) => update("description", event.target.value)}
              required
              value={design.description}
            />
          </label>
        </div>

        <div className="admin-form-section">
          <h2 className="section-title">Colores</h2>
          <p className="field-hint">
            La validación exige contraste AA para texto y etiquetas.
          </p>
          <div className="apple-wallet-color-grid">
            <label className="field">
              <span>Fondo</span>
              <input
                aria-label="Color de fondo"
                name="backgroundColor"
                onChange={(event) => update("backgroundColor", event.target.value)}
                type="color"
                value={design.backgroundColor}
              />
              <small>{design.backgroundColor.toUpperCase()}</small>
            </label>
            <label className="field">
              <span>Texto</span>
              <input
                aria-label="Color de texto"
                name="foregroundColor"
                onChange={(event) => update("foregroundColor", event.target.value)}
                type="color"
                value={design.foregroundColor}
              />
              <small>{design.foregroundColor.toUpperCase()}</small>
            </label>
            <label className="field">
              <span>Etiquetas</span>
              <input
                aria-label="Color de etiquetas"
                name="labelColor"
                onChange={(event) => update("labelColor", event.target.value)}
                type="color"
                value={design.labelColor}
              />
              <small>{design.labelColor.toUpperCase()}</small>
            </label>
          </div>
        </div>

        <div className="admin-form-section">
          <h2 className="section-title">Imágenes</h2>
          <p className="field-hint">
            Usa HTTPS. Para generar el pase, el host debe estar autorizado en el servidor.
          </p>
          <label className="field">
            <span>Logo</span>
            <input
              name="logoImageUrl"
              onChange={(event) => update("logoImageUrl", event.target.value)}
              placeholder="https://…/logo.png"
              type="url"
              value={design.logoImageUrl}
            />
          </label>
          <label className="field">
            <span>Imagen principal</span>
            <input
              name="stripImageUrl"
              onChange={(event) => update("stripImageUrl", event.target.value)}
              placeholder="https://…/wallet-strip.jpg"
              type="url"
              value={design.stripImageUrl}
            />
          </label>
        </div>
        <SubmitButton>Guardar diseño</SubmitButton>
      </form>

      <aside className="apple-wallet-preview-panel" aria-labelledby="apple-wallet-preview-title">
        <div>
          <p className="enterprise-breadcrumb">Vista previa</p>
          <h2 id="apple-wallet-preview-title">Tarjeta de cliente</h2>
          <p>Apple adapta el resultado final según el dispositivo.</p>
        </div>
        <div className="apple-pass-preview" style={previewStyle}>
          <header>
            {design.logoImageUrl ? (
              <img alt="Logo configurado" src={design.logoImageUrl} />
            ) : (
              <span className="apple-pass-preview-mark" aria-hidden="true">SW</span>
            )}
            <strong>{design.logoText || "Nombre del negocio"}</strong>
            <small><span>PREMIOS</span>1</small>
          </header>
          {design.stripImageUrl ? (
            <img className="apple-pass-preview-strip" alt="Imagen principal configurada" src={design.stripImageUrl} />
          ) : null}
          <div className="apple-pass-preview-content">
            <p><span>SELLOS</span><strong>4</strong></p>
            <div><p><span>CLIENTE</span><strong>Cliente ejemplo</strong></p><p><span>META</span><strong>10 sellos</strong></p></div>
            <div className="apple-pass-preview-code" aria-hidden="true">▦</div>
          </div>
        </div>
        <p className="apple-wallet-preview-note">
          La vista previa representa jerarquía, colores e imágenes; Wallet controla tipografía, recortes y dimensiones finales.
        </p>
      </aside>
    </div>
  );
}
