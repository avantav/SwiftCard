"use client";

/* Tenant images upload to an RLS-scoped public Supabase Storage bucket. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type CSSProperties } from "react";
import { saveAppleWalletDesign } from "@/app/admin/wallet/actions";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  APPLE_WALLET_ASSET_BUCKET,
  createAppleWalletAssetPath,
  validateAppleWalletAssetFile,
  type AppleWalletAssetKind,
} from "@/lib/wallet/assets";

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
  fallbackAssets,
  initial,
  tenantId,
}: {
  fallbackAssets: { logoImageUrl: string; stripImageUrl: string };
  initial: AppleWalletDesignValues;
  tenantId: string;
}) {
  const [design, setDesign] = useState(initial);
  const pendingPaths = useRef<Record<AppleWalletAssetKind, string | null>>({
    logo: null,
    strip: null,
  });
  const [uploads, setUploads] = useState<
    Record<
      AppleWalletAssetKind,
      {
        status: "idle" | "uploading" | "success" | "error";
        message: string;
      }
    >
  >({
    logo: { status: "idle", message: "" },
    strip: { status: "idle", message: "" },
  });
  const update = <Key extends keyof AppleWalletDesignValues>(
    key: Key,
    value: AppleWalletDesignValues[Key],
  ) => setDesign((current) => ({ ...current, [key]: value }));
  const previewStyle = {
    "--apple-pass-background": design.backgroundColor,
    "--apple-pass-foreground": design.foregroundColor,
    "--apple-pass-label": design.labelColor,
  } as CSSProperties;
  const isUploading = Object.values(uploads).some(
    (upload) => upload.status === "uploading",
  );
  const previewLogoUrl = design.logoImageUrl || fallbackAssets.logoImageUrl;
  const previewStripUrl = design.stripImageUrl || fallbackAssets.stripImageUrl;

  async function uploadAsset(kind: AppleWalletAssetKind, file: File) {
    const validationError = validateAppleWalletAssetFile(file);
    if (validationError) {
      setUploads((current) => ({
        ...current,
        [kind]: { status: "error", message: validationError },
      }));
      return;
    }

    setUploads((current) => ({
      ...current,
      [kind]: { status: "uploading", message: "Subiendo imagen…" },
    }));
    const supabase = createSupabaseBrowserClient();
    const path = createAppleWalletAssetPath(
      tenantId,
      kind,
      file.type as "image/png" | "image/jpeg" | "image/webp",
    );
    const { error } = await supabase.storage
      .from(APPLE_WALLET_ASSET_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (error) {
      setUploads((current) => ({
        ...current,
        [kind]: {
          status: "error",
          message:
            "No se pudo subir la imagen. Confirma que la migración de Storage esté aplicada.",
        },
      }));
      return;
    }

    const { data } = supabase.storage
      .from(APPLE_WALLET_ASSET_BUCKET)
      .getPublicUrl(path);
    const previousPendingPath = pendingPaths.current[kind];
    if (previousPendingPath && previousPendingPath !== path) {
      await supabase.storage
        .from(APPLE_WALLET_ASSET_BUCKET)
        .remove([previousPendingPath]);
    }
    pendingPaths.current[kind] = path;
    const key = kind === "logo" ? "logoImageUrl" : "stripImageUrl";
    setDesign((current) => ({ ...current, [key]: data.publicUrl }));
    setUploads((current) => ({
      ...current,
      [kind]: {
        status: "success",
        message: "Imagen cargada. Guarda el diseño para publicarla.",
      },
    }));
  }

  function clearAsset(kind: AppleWalletAssetKind) {
    const pendingPath = pendingPaths.current[kind];
    if (pendingPath) {
      pendingPaths.current[kind] = null;
      const supabase = createSupabaseBrowserClient();
      void supabase.storage
        .from(APPLE_WALLET_ASSET_BUCKET)
        .remove([pendingPath]);
    }
    const key = kind === "logo" ? "logoImageUrl" : "stripImageUrl";
    setDesign((current) => ({ ...current, [key]: "" }));
    setUploads((current) => ({
      ...current,
      [kind]: {
        status: "idle",
        message: "Se usará la imagen general del tenant al guardar.",
      },
    }));
  }

  return (
    <div className="apple-wallet-editor">
      <form
        className="auth-form apple-wallet-form"
        action={saveAppleWalletDesign}
        onSubmit={(event) => {
          if (isUploading) event.preventDefault();
        }}
      >
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
            Sube PNG, JPEG o WebP de hasta 5 MB. Las imágenes se guardan en el
            espacio seguro de tu tenant.
          </p>
          <input name="logoImageUrl" type="hidden" value={design.logoImageUrl} />
          <input name="stripImageUrl" type="hidden" value={design.stripImageUrl} />
          <div className="apple-wallet-upload-grid">
            {([
              {
                kind: "logo" as const,
                label: "Logo",
                hint:
                  "Lienzo Apple: entre 50 y 160 pt de ancho por 50 pt de alto, con fondo transparente.",
              },
              {
                kind: "strip" as const,
                label: "Imagen principal",
                hint:
                  "Lienzo Apple: 375 × 144 pt. Deja la zona superior izquierda limpia y con contraste para el saldo.",
              },
            ]).map((asset) => (
              <div className="apple-wallet-upload-field" key={asset.kind}>
                <label className="field" htmlFor={`wallet-${asset.kind}-file`}>
                  <span>{asset.label}</span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploads[asset.kind].status === "uploading"}
                    id={`wallet-${asset.kind}-file`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAsset(asset.kind, file);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                  <small>{asset.hint}</small>
                </label>
                {(asset.kind === "logo"
                  ? design.logoImageUrl
                  : design.stripImageUrl) ? (
                  <button
                    className="secondary-button"
                    onClick={() => clearAsset(asset.kind)}
                    type="button"
                  >
                    Quitar imagen personalizada
                  </button>
                ) : null}
                {uploads[asset.kind].message ? (
                  <p
                    className={`apple-wallet-upload-status is-${uploads[asset.kind].status}`}
                    role={
                      uploads[asset.kind].status === "error" ? "alert" : "status"
                    }
                  >
                    {uploads[asset.kind].message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <SubmitButton disabled={isUploading}>Guardar diseño</SubmitButton>
      </form>

      <aside className="apple-wallet-preview-panel" aria-labelledby="apple-wallet-preview-title">
        <div>
          <p className="enterprise-breadcrumb">Vista previa</p>
          <h2 id="apple-wallet-preview-title">Vista frontal en iPhone</h2>
          <p>Simulación de la plantilla storeCard publicada en Wallet.</p>
        </div>
        <div className="apple-pass-preview" style={previewStyle}>
          <header>
            <div className="apple-pass-preview-identity">
              {previewLogoUrl ? (
                <img alt="Logo configurado" src={previewLogoUrl} />
              ) : (
                <span className="apple-pass-preview-mark" aria-hidden="true">SW</span>
              )}
              <strong>{design.logoText || "Nombre del negocio"}</strong>
            </div>
            <p className="apple-pass-preview-header-field">
              <span>PREMIOS</span>
              <strong>1</strong>
            </p>
          </header>
          <div
            className={`apple-pass-preview-primary${previewStripUrl ? " has-strip" : ""}`}
          >
            {previewStripUrl ? (
              <img
                className="apple-pass-preview-strip"
                alt="Imagen principal configurada"
                src={previewStripUrl}
              />
            ) : null}
            <p>
              <span>SELLOS</span>
              <strong>4</strong>
            </p>
          </div>
          <div className="apple-pass-preview-content">
            <div className="apple-pass-preview-supporting-fields">
              <p>
                <span>CLIENTE</span>
                <strong>Cliente ejemplo</strong>
              </p>
              <p>
                <span>META</span>
                <strong>10 sellos</strong>
              </p>
            </div>
            <figure className="apple-pass-preview-code">
              <img alt="" src="/icons/wallet-preview-qr.svg" />
              <figcaption>
                Tarjeta de {design.logoText || "Nombre del negocio"}
              </figcaption>
            </figure>
          </div>
        </div>
        <p className="apple-wallet-preview-note">
          Usa los mismos campos, orden, proporciones de imagen y colores del pase. Apple controla la tipografía y puede ajustar texto o recortes según la versión de iOS y el dispositivo.
        </p>
      </aside>
    </div>
  );
}
