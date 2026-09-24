"use client";

/* Administrators may preview validated local files and tenant-hosted HTTPS images. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AppleWalletDesignValues } from "@/components/apple-wallet-design-form";
import { AppleStoreCardPreview } from "@/components/apple-store-card-preview";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  APPLE_WALLET_ASSET_BUCKET,
  createAppleWalletAssetPath,
  validateAppleWalletAssetFile,
  type AppleWalletAssetKind,
} from "@/lib/wallet/assets";
import { normalizeAppleWalletStampRows } from "@/lib/wallet/apple-stamp-layout";

type CardDesignPreviewContext = {
  tenantName: string;
  programName: string;
  programType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  rewardGoal: number | null;
  unitNameSingular: string;
  unitNamePlural: string;
  fallbackLogoImageUrl: string;
  fallbackStripImageUrl: string;
};

type CardWalletDesignValues = AppleWalletDesignValues & {
  notificationIconUrl: string;
  logoScalePercent: number;
  logoMarginXPercent: number;
  logoMarginYPercent: number;
  stripScalePercent: number;
  stripMarginXPercent: number;
  stripMarginYPercent: number;
  stripDimmingEnabled: boolean;
  stripStampsEnabled: boolean;
  stampIconUrl: string;
  stampEmptySlotsEnabled: boolean;
  stampRowCounts: number[];
  stampPositionXPercent: number;
  stampPositionYPercent: number;
};

const assetDesignKey: Record<AppleWalletAssetKind, keyof Pick<
  CardWalletDesignValues,
  "logoImageUrl" | "stripImageUrl" | "notificationIconUrl" | "stampIconUrl"
>> = {
  logo: "logoImageUrl",
  strip: "stripImageUrl",
  notification: "notificationIconUrl",
  stamp: "stampIconUrl",
};

export function CardDesignEditor({
  initial,
  preview,
  stampLayoutSupported = true,
  stripDimmingSupported = true,
  stripStampsSupported = true,
  tenantId,
}: {
  initial: CardWalletDesignValues;
  preview: CardDesignPreviewContext;
  stampLayoutSupported?: boolean;
  stripDimmingSupported?: boolean;
  stripStampsSupported?: boolean;
  tenantId: string;
}) {
  const [design, setDesign] = useState(initial);
  const [provider, setProvider] = useState<"APPLE" | "GOOGLE">("APPLE");
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingPaths = useRef<Record<AppleWalletAssetKind, string | null>>({ logo: null, strip: null, notification: null, stamp: null });
  const localPreviewUrls = useRef<Record<AppleWalletAssetKind, string | null>>({ logo: null, strip: null, notification: null, stamp: null });
  const [localPreviews, setLocalPreviews] = useState<Record<AppleWalletAssetKind, string | null>>({ logo: null, strip: null, notification: null, stamp: null });
  const [uploads, setUploads] = useState<Record<AppleWalletAssetKind, { status: "idle" | "uploading" | "success" | "error"; message: string }>>({
    logo: { status: "idle", message: "" },
    strip: { status: "idle", message: "" },
    notification: { status: "idle", message: "" },
    stamp: { status: "idle", message: "" },
  });
  const update = <Key extends keyof CardWalletDesignValues>(
    key: Key,
    value: CardWalletDesignValues[Key],
  ) => setDesign((current) => ({ ...current, [key]: value }));
  const style = {
    "--card-preview-background": design.backgroundColor,
    "--card-preview-foreground": design.foregroundColor,
    "--card-preview-label": design.labelColor,
    "--card-logo-scale": design.logoScalePercent / 100,
    "--card-logo-margin-x": `${design.logoMarginXPercent}%`,
    "--card-logo-margin-y": `${design.logoMarginYPercent}%`,
    "--card-strip-scale": design.stripScalePercent / 100,
    "--card-strip-margin-x": `${design.stripMarginXPercent}%`,
    "--card-strip-margin-y": `${design.stripMarginYPercent}%`,
  } as CSSProperties;
  const effectiveDesign = {
    ...design,
    logoImageUrl: localPreviews.logo || design.logoImageUrl || preview.fallbackLogoImageUrl,
    stripImageUrl: localPreviews.strip || design.stripImageUrl || preview.fallbackStripImageUrl,
    stampIconUrl: localPreviews.stamp || design.stampIconUrl,
  };
  const notificationIconPreviewUrl = localPreviews.notification
    || design.notificationIconUrl
    || effectiveDesign.logoImageUrl;
  const previewGoal = Math.max(1, preview.rewardGoal ?? 10);
  const previewBalance = Math.min(
    previewGoal,
    Math.max(1, Math.floor(previewGoal * 0.4)),
  );
  const lifetimePoints = preview.programType === "LIFETIME_POINTS";
  const visibleStampCount = Math.min(previewGoal, 24);
  const stampRows = normalizeAppleWalletStampRows(visibleStampCount, design.stampRowCounts);
  const googleVisibleStamps = Math.min(previewGoal, 10);
  const googleFilledStamps = Math.min(
    googleVisibleStamps,
    Math.max(1, Math.round((previewBalance / previewGoal) * googleVisibleStamps)),
  );
  const isUploading = Object.values(uploads).some((upload) => upload.status === "uploading");
  const hasUnsavedChanges = localPreviews.logo !== null
    || localPreviews.strip !== null
    || localPreviews.notification !== null
    || Object.keys(initial).some((key) => (
      design[key as keyof CardWalletDesignValues]
        !== initial[key as keyof CardWalletDesignValues]
    ));

  function removeLastStampRow() {
    const candidate = stampRows.slice(0, -1);
    let remaining = visibleStampCount - candidate.reduce((total, count) => total + count, 0);
    for (let index = candidate.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const added = Math.min(8 - candidate[index], remaining);
      candidate[index] += added;
      remaining -= added;
    }
    update("stampRowCounts", normalizeAppleWalletStampRows(visibleStampCount, candidate));
  }

  useEffect(() => {
    const form = editorRef.current?.closest("form");
    if (!form) return;
    const preventSubmitWhileUploading = (event: SubmitEvent) => {
      if (isUploading) event.preventDefault();
    };
    form.addEventListener("submit", preventSubmitWhileUploading, true);
    return () => form.removeEventListener("submit", preventSubmitWhileUploading, true);
  }, [isUploading]);

  useEffect(() => {
    const previewUrls = localPreviewUrls.current;
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  function setLocalPreview(kind: AppleWalletAssetKind, file: File) {
    const previous = localPreviewUrls.current[kind];
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(file);
    localPreviewUrls.current[kind] = url;
    setLocalPreviews((current) => ({ ...current, [kind]: url }));
  }

  function clearLocalPreview(kind: AppleWalletAssetKind) {
    const url = localPreviewUrls.current[kind];
    if (url) URL.revokeObjectURL(url);
    localPreviewUrls.current[kind] = null;
    setLocalPreviews((current) => ({ ...current, [kind]: null }));
  }

  async function uploadAsset(kind: AppleWalletAssetKind, file: File) {
    const validationError = validateAppleWalletAssetFile(file);
    if (validationError) {
      setUploads((current) => ({ ...current, [kind]: { status: "error", message: validationError } }));
      return;
    }
    setLocalPreview(kind, file);
    setUploads((current) => ({ ...current, [kind]: { status: "uploading", message: "Subiendo imagen…" } }));
    const supabase = createSupabaseBrowserClient();
    const path = createAppleWalletAssetPath(tenantId, kind, file.type as "image/png" | "image/jpeg" | "image/webp");
    const { error } = await supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      clearLocalPreview(kind);
      setUploads((current) => ({ ...current, [kind]: { status: "error", message: "No se pudo subir la imagen. Confirma que Storage esté configurado." } }));
      return;
    }
    const { data } = supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).getPublicUrl(path);
    const previousPath = pendingPaths.current[kind];
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(APPLE_WALLET_ASSET_BUCKET).remove([previousPath]);
    }
    pendingPaths.current[kind] = path;
    update(assetDesignKey[kind], data.publicUrl);
    setUploads((current) => ({ ...current, [kind]: { status: "success", message: "Imagen cargada. Guarda esta etapa para aplicarla." } }));
  }

  function clearAsset(kind: AppleWalletAssetKind) {
    clearLocalPreview(kind);
    const pendingPath = pendingPaths.current[kind];
    if (pendingPath) {
      pendingPaths.current[kind] = null;
      void createSupabaseBrowserClient().storage.from(APPLE_WALLET_ASSET_BUCKET).remove([pendingPath]);
    }
    update(assetDesignKey[kind], "");
    setUploads((current) => ({ ...current, [kind]: { status: "idle", message: "La imagen se quitará al guardar esta etapa." } }));
  }

  function resetImageLayout(kind: "logo" | "strip") {
    if (kind === "logo") {
      setDesign((current) => ({
        ...current,
        logoScalePercent: 100,
        logoMarginXPercent: 0,
        logoMarginYPercent: 0,
      }));
      return;
    }
    setDesign((current) => ({
      ...current,
      stripScalePercent: 100,
      stripMarginXPercent: 0,
      stripMarginYPercent: 0,
    }));
  }

  return (
    <div aria-busy={isUploading} className="card-design-layout" ref={editorRef}>
      <div className="card-design-fields">
        <section className="card-design-section" aria-labelledby="card-identity-heading">
          <div className="card-design-section-heading">
            <div>
              <h3 id="card-identity-heading">Identidad</h3>
              <p>Define el nombre que verá el cliente.</p>
            </div>
            <label className="wallet-availability-toggle">
              <input
                checked={design.appleEnabled}
                name="appleEnabled"
                onChange={(event) => update("appleEnabled", event.target.checked)}
                type="checkbox"
              />
              <span aria-hidden="true" />
              <strong>{design.appleEnabled ? "Disponible" : "Deshabilitada"}</strong>
            </label>
          </div>
          <div className="card-design-copy-fields">
            <label className="field">
              <span>Nombre en la tarjeta (opcional)</span>
              <input maxLength={60} name="logoText" onChange={(event) => update("logoText", event.target.value)} onInput={(event) => update("logoText", event.currentTarget.value)} value={design.logoText} />
              <small>Déjalo vacío si el logo ya incluye el nombre del negocio.</small>
            </label>
            <label className="field">
              <span>Descripción interna</span>
              <input maxLength={120} name="description" onChange={(event) => update("description", event.target.value)} onInput={(event) => update("description", event.currentTarget.value)} required value={design.description} />
              <small>Apple la usa como metadato; no aparece al frente.</small>
            </label>
          </div>
        </section>

        <section className="card-design-section" aria-labelledby="card-colors-heading">
          <div className="card-design-section-heading">
            <div>
              <h3 id="card-colors-heading">Colores</h3>
              <p>Selecciona el fondo y los textos de la tarjeta.</p>
            </div>
          </div>
          <div className="card-color-fields">
            {([
              ["backgroundColor", "Fondo"],
              ["foregroundColor", "Texto principal"],
              ["labelColor", "Etiquetas"],
            ] as const).map(([key, label]) => (
              <label className="card-color-field" key={key}>
                <input aria-label={`Color de ${label.toLocaleLowerCase("es-MX")}`} name={key} onChange={(event) => update(key, event.target.value.toUpperCase())} onInput={(event) => update(key, event.currentTarget.value.toUpperCase())} type="color" value={design[key]} />
                <span><strong>{label}</strong><small>{design[key]}</small></span>
              </label>
            ))}
          </div>
        </section>

        <section className="card-design-section" aria-labelledby="card-images-heading">
          <div className="card-design-section-heading">
            <div>
              <h3 id="card-images-heading">Imágenes</h3>
              <p>PNG, JPEG o WebP de hasta 5 MB.</p>
            </div>
          </div>
          <input name="logoImageUrl" type="hidden" value={design.logoImageUrl} />
          <input name="stripImageUrl" type="hidden" value={design.stripImageUrl} />
          <input name="notificationIconUrl" type="hidden" value={design.notificationIconUrl} />
          <input name="stampIconUrl" type="hidden" value={design.stampIconUrl} />
          <div className="wallet-asset-list">
            {([
              { kind: "logo" as const, label: "Logo", hint: "Identidad visible en la parte superior." },
              { kind: "strip" as const, label: "Imagen principal", hint: lifetimePoints ? "Fondo del saldo y el siguiente hito." : "Fondo del progreso de sellos." },
              ...(!lifetimePoints && stampLayoutSupported ? [{ kind: "stamp" as const, label: "Icono de sello", hint: "Opcional. Se repite en cada sello obtenido; si falta, se usa el logo." }] : []),
              { kind: "notification" as const, label: "Icono de notificaciones", hint: "Opcional y cuadrado. Si falta, se usa el logo." },
            ]).map((asset) => {
              const imageUrl = asset.kind === "logo"
                ? effectiveDesign.logoImageUrl
                : asset.kind === "strip"
                  ? effectiveDesign.stripImageUrl
                  : asset.kind === "stamp"
                    ? effectiveDesign.stampIconUrl
                    : notificationIconPreviewUrl;
              const configuredImageUrl = design[assetDesignKey[asset.kind]];
              const usesFallback = !configuredImageUrl && Boolean(imageUrl);
              const imageState = localPreviews[asset.kind]
                ? "Cambio sin guardar"
                : usesFallback
                  ? "Usando imagen de respaldo"
                  : imageUrl
                    ? "Imagen configurada"
                    : "Sin imagen";
              return (
                <article className="wallet-asset-row" key={asset.kind}>
                  <div className={`card-upload-image-preview is-${asset.kind}${imageUrl ? " has-image" : ""}`}>
                    {imageUrl ? (
                      <img
                        alt={asset.kind === "logo"
                          ? "Logo usado en la vista previa"
                          : asset.kind === "strip"
                            ? "Imagen principal usada en la vista previa"
                            : asset.kind === "stamp"
                              ? "Icono usado dentro de los sellos"
                              : "Icono usado en las notificaciones de Apple Wallet"}
                        src={imageUrl}
                      />
                    ) : <span className="wallet-asset-empty" aria-hidden="true">Sin imagen</span>}
                  </div>
                  <div className="wallet-asset-copy">
                    <div><h4>{asset.label}</h4><p>{asset.hint}</p></div>
                    <small>{imageState}</small>
                    {asset.kind === "strip" ? (
                      <div className="wallet-image-options">
                        {!lifetimePoints ? (
                          <label className="wallet-image-option">
                            {!stripStampsSupported ? <input name="stripStampsEnabled" type="hidden" value="on" /> : null}
                            <input
                              checked={design.stripStampsEnabled}
                              disabled={!stripStampsSupported}
                              name="stripStampsEnabled"
                              onChange={(event) => update("stripStampsEnabled", event.target.checked)}
                              type="checkbox"
                            />
                            <span>
                              <strong>Mostrar sellos sobre la imagen</strong>
                              <small>{stripStampsSupported
                                ? "Desactívalo para mostrar la imagen principal sin los círculos de progreso."
                                : "Disponible al aplicar la migración 0064."}</small>
                            </span>
                          </label>
                        ) : <input name="stripStampsEnabled" type="hidden" value={design.stripStampsEnabled ? "on" : ""} />}
                        <label className="wallet-image-option">
                          {!stripDimmingSupported ? <input name="stripDimmingEnabled" type="hidden" value="on" /> : null}
                          <input
                            checked={design.stripDimmingEnabled}
                            disabled={!stripDimmingSupported}
                            name="stripDimmingEnabled"
                            onChange={(event) => update("stripDimmingEnabled", event.target.checked)}
                            type="checkbox"
                          />
                          <span>
                            <strong>Oscurecer para resaltar el progreso</strong>
                            <small>{stripDimmingSupported
                              ? "Desactívalo para conservar el brillo original."
                              : "Disponible al aplicar la migración 0063."}</small>
                          </span>
                        </label>
                      </div>
                    ) : null}
                    {uploads[asset.kind].message ? (
                      <p
                        className={`apple-wallet-upload-status is-${uploads[asset.kind].status}`}
                        role={uploads[asset.kind].status === "error" ? "alert" : "status"}
                      >
                        {uploads[asset.kind].message}
                      </p>
                    ) : null}
                  </div>
                  <div className="wallet-asset-actions">
                    <label className="secondary-button" htmlFor={`card-${asset.kind}-file`}>
                      {configuredImageUrl ? "Cambiar" : "Elegir imagen"}
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploads[asset.kind].status === "uploading"}
                      id={`card-${asset.kind}-file`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAsset(asset.kind, file);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                    </label>
                  {configuredImageUrl ? (
                    <button className="tertiary-button" onClick={() => clearAsset(asset.kind)} type="button">
                      Quitar
                    </button>
                  ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          {!lifetimePoints ? (
            <section className="wallet-stamp-layout-editor" aria-labelledby="wallet-stamp-layout-heading">
              <input name="stampRowCounts" type="hidden" value={stampLayoutSupported ? stampRows.join(",") : ""} />
              <input name="stampPositionXPercent" type="hidden" value={design.stampPositionXPercent} />
              <input name="stampPositionYPercent" type="hidden" value={design.stampPositionYPercent} />
              <div className="wallet-image-layout-heading">
                <div>
                  <h4 id="wallet-stamp-layout-heading">Distribución de sellos</h4>
                  <p>Define cuántos van en cada fila y arrastra el bloque sobre la cuadrícula de la vista previa.</p>
                  {!stampLayoutSupported ? <p>Disponible al aplicar la migración 0066.</p> : null}
                </div>
                <button
                  className="tertiary-button"
                  disabled={!stampLayoutSupported}
                  onClick={() => setDesign((current) => ({
                    ...current,
                    stampRowCounts: [],
                    stampPositionXPercent: 50,
                    stampPositionYPercent: 50,
                  }))}
                  type="button"
                >Restablecer</button>
              </div>
              <div className="wallet-stamp-row-controls">
                {stampRows.map((count, index) => (
                  <label className="field" key={index}>
                    <span>Fila {index + 1}</span>
                    <input
                      aria-label={`Sellos en fila ${index + 1}`}
                      disabled={!stampLayoutSupported}
                      max={8}
                      min={1}
                      onChange={(event) => {
                        const candidate = [...stampRows];
                        candidate[index] = Number(event.target.value);
                        update("stampRowCounts", normalizeAppleWalletStampRows(visibleStampCount, candidate));
                      }}
                      type="number"
                      value={count}
                    />
                  </label>
                ))}
              </div>
              <div className="wallet-stamp-layout-actions">
                <button
                  className="secondary-button"
                  disabled={!stampLayoutSupported || stampRows.length >= 6 || stampRows.every((count) => count <= 1)}
                  onClick={() => {
                    const candidate = [...stampRows];
                    const splitIndex = candidate.findIndex((count) => count > 1);
                    if (splitIndex < 0) return;
                    const count = candidate[splitIndex];
                    candidate.splice(splitIndex, 1, Math.ceil(count / 2), Math.floor(count / 2));
                    update("stampRowCounts", normalizeAppleWalletStampRows(visibleStampCount, candidate));
                  }}
                  type="button"
                >Agregar fila</button>
                <button
                  className="tertiary-button"
                  disabled={!stampLayoutSupported || stampRows.length <= 1 || visibleStampCount > (stampRows.length - 1) * 8}
                  onClick={removeLastStampRow}
                  type="button"
                >Quitar última fila</button>
                <span>{stampRows.reduce((total, count) => total + count, 0)} sellos · posición {design.stampPositionXPercent}%, {design.stampPositionYPercent}%</span>
              </div>
              <div className="wallet-stamp-position-controls">
                <label className="field wallet-range-field">
                  <span>Posición horizontal <output>{design.stampPositionXPercent}%</output></span>
                  <input
                    disabled={!stampLayoutSupported}
                    max="100"
                    min="0"
                    onChange={(event) => update("stampPositionXPercent", Number(event.target.value))}
                    type="range"
                    value={design.stampPositionXPercent}
                  />
                </label>
                <label className="field wallet-range-field">
                  <span>Posición vertical <output>{design.stampPositionYPercent}%</output></span>
                  <input
                    disabled={!stampLayoutSupported}
                    max="100"
                    min="0"
                    onChange={(event) => update("stampPositionYPercent", Number(event.target.value))}
                    type="range"
                    value={design.stampPositionYPercent}
                  />
                </label>
              </div>
              <label className="wallet-image-option">
                {!stampLayoutSupported ? <input name="stampEmptySlotsEnabled" type="hidden" value="on" /> : null}
                <input
                  checked={design.stampEmptySlotsEnabled}
                  disabled={!stampLayoutSupported}
                  name="stampEmptySlotsEnabled"
                  onChange={(event) => update("stampEmptySlotsEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Mostrar espacios sin sellar</strong>
                  <small>Desactívalo para enseñar únicamente los sellos obtenidos.</small>
                </span>
              </label>
            </section>
          ) : (
            <>
              <input name="stampRowCounts" type="hidden" value="" />
              <input name="stampPositionXPercent" type="hidden" value="50" />
              <input name="stampPositionYPercent" type="hidden" value="50" />
              <input name="stampEmptySlotsEnabled" type="hidden" value="on" />
            </>
          )}
          <details className="wallet-advanced-controls">
            <summary>
              <span><strong>Ajustar encuadre</strong><small>Opcional · dentro del área fija de Apple</small></span>
            </summary>
            <div className="wallet-image-layout-controls">
              {([
                {
                  kind: "logo" as const,
                  title: "Logo",
                  fields: [
                    ["logoScalePercent", "Tamaño dentro del área", 50, 100],
                    ["logoMarginXPercent", "Espacio lateral", 0, 20],
                    ["logoMarginYPercent", "Espacio superior e inferior", 0, 20],
                  ] as const,
                },
                {
                  kind: "strip" as const,
                  title: "Imagen principal",
                  fields: [
                    ["stripScalePercent", "Tamaño dentro del área", 50, 150],
                    ["stripMarginXPercent", "Espacio lateral", 0, 20],
                    ["stripMarginYPercent", "Espacio superior e inferior", 0, 20],
                  ] as const,
                },
              ]).map((group) => (
                <div className="wallet-image-layout-group" key={group.kind}>
                  <div className="wallet-image-layout-heading">
                    <h4>{group.title}</h4>
                    <button className="tertiary-button" onClick={() => resetImageLayout(group.kind)} type="button">Restablecer</button>
                  </div>
                  {group.fields.map(([key, label, min, max]) => (
                    <label className="field wallet-range-field" key={key}>
                      <span>{label} <output>{design[key]}%</output></span>
                      <input
                        max={max}
                        min={min}
                        name={key}
                        onChange={(event) => update(key, Number(event.target.value))}
                        step="1"
                        type="range"
                        value={design[key]}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p>El encuadre nunca mueve campos ni cambia la estructura del pase. Google Wallet usa las imágenes originales dentro de las zonas que controla.</p>
          </details>
          {isUploading ? <p className="enterprise-alert is-info" role="status">Espera a que terminen las cargas antes de guardar.</p> : null}
        </section>
      </div>
      <aside className="card-provider-preview" aria-labelledby="card-preview-heading">
        <div className="card-preview-heading">
          <div><p className="enterprise-breadcrumb">Vista previa en vivo</p><h3 id="card-preview-heading">{provider === "APPLE" ? "Apple Wallet · storeCard" : "Google Wallet · pase de lealtad"}</h3><small className={hasUnsavedChanges ? "is-dirty" : ""} role="status">{hasUnsavedChanges ? "Mostrando cambios sin guardar" : "Mostrando el diseño guardado"}</small></div>
          <div className="card-provider-toggle" role="group" aria-label="Proveedor de vista previa">
            <button aria-pressed={provider === "APPLE"} onClick={() => setProvider("APPLE")} type="button">Apple</button>
            <button aria-pressed={provider === "GOOGLE"} onClick={() => setProvider("GOOGLE")} type="button">Android</button>
          </div>
        </div>
        {provider === "APPLE" ? (
          <AppleStoreCardPreview
            design={effectiveDesign}
            onStampPositionChange={lifetimePoints || !design.stripStampsEnabled || !stampLayoutSupported
              ? undefined
              : (xPercent, yPercent) => setDesign((current) => ({
                  ...current,
                  stampPositionXPercent: xPercent,
                  stampPositionYPercent: yPercent,
                }))}
            programType={preview.programType}
            programName={preview.programName}
            rewardGoal={preview.rewardGoal}
            tenantName={preview.tenantName}
            unitNamePlural={preview.unitNamePlural}
            unitNameSingular={preview.unitNameSingular}
          />
        ) : (
          <div className="unified-wallet-preview is-google" style={style}>
            {effectiveDesign.stripImageUrl ? <img alt="Imagen principal de la tarjeta" className="unified-wallet-strip-background" src={effectiveDesign.stripImageUrl} /> : null}
            <header>
              {effectiveDesign.logoImageUrl ? <img alt="Logo de la tarjeta" src={effectiveDesign.logoImageUrl} /> : <span aria-hidden="true">SW</span>}
              {design.logoText ? <strong>{design.logoText}</strong> : null}
            </header>
            {lifetimePoints ? <div className="unified-wallet-points"><span>{preview.unitNamePlural}</span><strong>{previewBalance}</strong><div aria-hidden="true"><i style={{ width: `${Math.round((previewBalance / previewGoal) * 100)}%` }} /></div><small>Próximo premio al llegar a {previewGoal}</small></div> : <div className="unified-wallet-stamps" role="img" aria-label={`${previewBalance} de ${previewGoal} ${preview.unitNamePlural}`}>
              {Array.from({ length: googleVisibleStamps }, (_, index) => <span className={index < googleFilledStamps ? "is-filled" : ""} key={index}>{index < googleFilledStamps ? "✓" : ""}</span>)}
            </div>}
            <div className="unified-wallet-meta"><p><span>CLIENTE</span><strong>Cliente ejemplo</strong></p><p><span>PROGRESO</span><strong>{lifetimePoints ? `${previewBalance} ${preview.unitNamePlural} acumulados` : `${previewBalance} de ${previewGoal} ${preview.unitNamePlural}`}</strong></p></div>
            <div className="unified-wallet-qr" aria-hidden="true"><span /><span /><span /></div>
          </div>
        )}
        <p className="card-preview-note">{provider === "APPLE" ? "Apple controla el acomodo final en cada dispositivo." : "Google controla el recorte y acomodo final."}</p>
      </aside>
    </div>
  );
}
