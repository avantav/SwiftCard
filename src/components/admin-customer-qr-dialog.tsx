"use client";

/* QR data URLs are generated locally and cannot use the Next image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";

export function AdminCustomerQrDialog({
  cardToken,
  claimPath,
  customerName,
  origin,
}: {
  cardToken: string;
  claimPath: string;
  customerName: string;
  origin: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrState, setQrState] = useState<"IDLE" | "LOADING" | "ERROR">("IDLE");

  async function openDialog() {
    dialogRef.current?.showModal();
    if (qrState !== "IDLE") return;
    if (!origin) {
      setQrState("ERROR");
      return;
    }
    setQrState("LOADING");
    try {
      const { createCustomerCardClaimQrDataUrl } = await import(
        "@/lib/customers/card-qr"
      );
      setQrDataUrl(await createCustomerCardClaimQrDataUrl(origin, cardToken));
    } catch {
      setQrState("ERROR");
    }
  }

  return (
    <>
      <button
        className="enterprise-secondary-action admin-customer-qr-trigger"
        onClick={() => void openDialog()}
        type="button"
      >
        Mostrar QR
      </button>
      <dialog
        aria-labelledby={titleId}
        className="enterprise-dialog admin-customer-qr-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <div className="enterprise-dialog-shell">
          <header className="enterprise-dialog-header">
            <div>
              <p>Entrega digital</p>
              <h2 id={titleId}>Agregar tarjeta de {customerName}</h2>
            </div>
            <button
              className="enterprise-dialog-close"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cerrar
            </button>
          </header>
          <div className="admin-customer-qr-body" aria-busy={qrState === "LOADING"}>
            {qrDataUrl ? (
              <img
                alt={`Código QR para entregar la tarjeta de ${customerName}`}
                height="240"
                src={qrDataUrl}
                width="240"
              />
            ) : qrState === "LOADING" ? (
              <p role="status">Generando QR…</p>
            ) : qrState === "ERROR" ? (
              <p className="enterprise-alert is-warning" role="alert">
                No se pudo generar el QR en este dominio.
              </p>
            ) : null}
            <p>
              El cliente debe escanearlo con su teléfono, revisar los términos y
              aceptar antes de agregar la tarjeta a Wallet.
            </p>
            <a
              className="enterprise-secondary-action"
              href={claimPath}
            >
              Abrir entrega en este dispositivo
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
