"use client";

/* Administrators may preview validated tenant-hosted HTTPS images. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type CSSProperties } from "react";
import type { AppleWalletDesignValues } from "@/components/apple-wallet-design-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  APPLE_WALLET_ASSET_BUCKET,
  createAppleWalletAssetPath,
  validateAppleWalletAssetFile,
  type AppleWalletAssetKind,
} from "@/lib/wallet/assets";

export function CardDesignEditor({ initial, tenantId }: { initial: AppleWalletDesignValues; tenantId: string }) {
  const [design, setDesign] = useState(initial);
  const [provider, setProvider] = useState<"APPLE" | "GOOGLE">("APPLE");
  const pendingPaths = useRef<Record<AppleWalletAssetKind, string | null>>({ logo: null, strip: null });
  const [uploads, setUploads] = useState<Record<AppleWalletAssetKind, { status: "idle" | "uploading" | "success" | "error"; message: string }>>({
    logo: { status: "idle", message: "" },
    strip: { status: "idle", message: "" },
  });
  const update = <Key extends keyof AppleWalletDesignValues>(
    key: Key,
    value: AppleWalletDesignValues[Key],
  ) => setDesign((current) => ({ ...current, [key]: value }));
  const style = {
    "--card-preview-background": design.backgroundColor,
    "--card-preview-foreground": design.foregroundColor,
    "--card-preview-label": design.labelColor,
  } as CSSProperties;
  const isUploading = Object.values(uploads).some((upload) => upload.status === "uploading");

  async function uploadAsset(kind: AppleWalletAssetKind, file: File) {
    const validationError = validateAppleWalletAssetFile(file);
    if (validationError) {
      setUploads((current) => ({ ...current, [kind]: { status: "error", message: validationError } }));
      return;
    }
    setUploads((current) => ({ ...current, [kind]: { status: "uploading", message: "Subiendo imagen…" } }));
    const supabase = createSupabaseBrowserClient();
    const path = createAppleWalletAssetPath(tenantId, kind, file.type as "image/png" | "image/jpeg" | "image/webp");
    const { error } = await supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setUploads((current) => ({ ...current, [kind]: { status: "error", message: "No se pudo subir la imagen. Confirma que Storage esté configurado." } }));
      return;
    }
    const { data } = supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).getPublicUrl(path);
    const previousPath = pendingPaths.current[kind];
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).remove([previousPath]);
    }
    pendingPaths.current[kind] = path;
    const key = kind === "logo" ? "logoImageUrl" : "stripImageUrl";
    update(key, data.publicUrl);
    setUploads((current) => ({ ...current, [kind]: { status: "success", message: "Imagen cargada. Guarda esta etapa para aplicarla." } }));
  }

  function clearAsset(kind: AppleWalletAssetKind) {
    const pendingPath = pendingPaths.current[kind];
    if (pendingPath) {
      pendingPaths.current[kind] = null;
      void createSupabaseBrowserClient().storage.from(APPLE_WALLET_ASSET_BUCKET).remove([pendingPath]);
    }
    update(kind === "logo" ? "logoImageUrl" : "stripImageUrl", "");
    setUploads((current) => ({ ...current, [kind]: { status: "idle", message: "La imagen se quitará al guardar esta etapa." } }));
  }

  return (
    <div className="card-design-layout">
      <div className="card-design-fields">
        <label className="check-field card-wizard-check">
          <input
            checked={design.appleEnabled}
            name="appleEnabled"
            onChange={(event) => update("appleEnabled", event.target.checked)}
            type="checkbox"
          />
          <span>Habilitar descarga cuando el proveedor esté configurado</span>
        </label>
        <label className="field">
          <span>Texto de marca</span>
          <input maxLength={60} name="logoText" onChange={(event) => update("logoText", event.target.value)} required value={design.logoText} />
        </label>
        <label className="field">
          <span>Descripción</span>
          <input maxLength={120} name="description" onChange={(event) => update("description", event.target.value)} required value={design.description} />
        </label>
        <div className="card-color-fields">
          {([
            ["backgroundColor", "Fondo"],
            ["foregroundColor", "Texto"],
            ["labelColor", "Etiquetas"],
          ] as const).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input name={key} onChange={(event) => update(key, event.target.value.toUpperCase())} type="color" value={design[key]} />
              <small>{design[key]}</small>
            </label>
          ))}
        </div>
        <div className="admin-form-section">
          <h3 className="section-title">Imágenes</h3>
          <p className="field-hint">Sube PNG, JPEG o WebP de hasta 5 MB. Se guardan en el espacio seguro del tenant y se reutilizan en ambas wallets.</p>
          <input name="logoImageUrl" type="hidden" value={design.logoImageUrl} />
          <input name="stripImageUrl" type="hidden" value={design.stripImageUrl} />
          <div className="apple-wallet-upload-grid">
            {([
              { kind: "logo" as const, label: "Logo", hint: "Preferentemente horizontal o cuadrado, con fondo transparente." },
              { kind: "strip" as const, label: "Imagen principal", hint: "Se usa como fondo visual detrás de los sellos." },
            ]).map((asset) => <div className="apple-wallet-upload-field" key={asset.kind}>
              <label className="field" htmlFor={`card-${asset.kind}-file`}><span>{asset.label}</span><input accept="image/png,image/jpeg,image/webp" disabled={uploads[asset.kind].status === "uploading"} id={`card-${asset.kind}-file`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(asset.kind, file); event.target.value = ""; }} type="file" /><small>{asset.hint}</small></label>
              {(asset.kind === "logo" ? design.logoImageUrl : design.stripImageUrl) ? <button className="secondary-button" onClick={() => clearAsset(asset.kind)} type="button">Quitar imagen</button> : null}
              {uploads[asset.kind].message ? <p className={`apple-wallet-upload-status is-${uploads[asset.kind].status}`} role={uploads[asset.kind].status === "error" ? "alert" : "status"}>{uploads[asset.kind].message}</p> : null}
            </div>)}
          </div>
          {isUploading ? <p className="enterprise-alert is-info" role="status">Espera a que terminen las cargas antes de guardar.</p> : null}
        </div>
      </div>
      <aside className="card-provider-preview" aria-labelledby="card-preview-heading">
        <div className="card-preview-heading">
          <div><p className="enterprise-breadcrumb">Vista previa</p><h3 id="card-preview-heading">Un diseño, dos wallets</h3></div>
          <div className="card-provider-toggle" role="group" aria-label="Proveedor de vista previa">
            <button aria-pressed={provider === "APPLE"} onClick={() => setProvider("APPLE")} type="button">Apple</button>
            <button aria-pressed={provider === "GOOGLE"} onClick={() => setProvider("GOOGLE")} type="button">Android</button>
          </div>
        </div>
        <div className={`unified-wallet-preview is-${provider.toLowerCase()}`} style={style}>
          {design.stripImageUrl ? <img alt="Imagen principal de la tarjeta" className="unified-wallet-strip-background" src={design.stripImageUrl} /> : null}
          <header>
            {design.logoImageUrl ? <img alt="Logo de la tarjeta" src={design.logoImageUrl} /> : <span aria-hidden="true">SW</span>}
            <strong>{design.logoText || "Tu negocio"}</strong>
          </header>
          <div className="unified-wallet-stamps" role="img" aria-label="4 de 10 sellos acumulados">
            {Array.from({ length: 10 }, (_, index) => <span className={index < 4 ? "is-filled" : ""} key={index}>{index < 4 ? "✓" : ""}</span>)}
          </div>
          <div className="unified-wallet-meta"><p><span>CLIENTE</span><strong>Cliente ejemplo</strong></p><p><span>PROGRESO</span><strong>4 de 10 sellos</strong></p></div>
          <div className="unified-wallet-qr" aria-hidden="true"><span /><span /><span /></div>
        </div>
        <p className="field-hint">El mismo diseño alimenta ambos proveedores; cada wallet adapta tipografía y espaciado.</p>
      </aside>
    </div>
  );
}
