"use client";

import Image from "next/image";
import { useState } from "react";

export function PublicRegistrationShare({
  branchName,
  qrDataUrl,
  registrationUrl,
}: {
  branchName: string;
  qrDataUrl: string;
  registrationUrl: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const filename = `registro-${branchName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sucursal"}.png`;

  return (
    <div className="public-registration-share">
      <div className="public-registration-qr">
        <Image
          alt={`Código QR para el registro público de ${branchName}`}
          height={224}
          src={qrDataUrl}
          unoptimized
          width={224}
        />
      </div>
      <div className="public-registration-share-content">
        <label className="field">
          <span>Enlace público</span>
          <input readOnly value={registrationUrl} />
        </label>
        <div className="public-registration-share-actions">
          <button className="secondary-button" onClick={copyLink} type="button">
            Copiar enlace
          </button>
          <a className="secondary-button" download={filename} href={qrDataUrl}>
            Descargar QR
          </a>
          <a
            className="enterprise-secondary-action"
            href={registrationUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir página
          </a>
        </div>
        {copyState === "copied" ? (
          <p className="public-registration-copy-status is-success" role="status">
            Enlace copiado.
          </p>
        ) : null}
        {copyState === "error" ? (
          <p className="public-registration-copy-status is-error" role="alert">
            No se pudo copiar automáticamente. Selecciona el enlace y cópialo.
          </p>
        ) : null}
      </div>
    </div>
  );
}
