/* QR data URLs are generated locally and cannot use the Next image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { customerCardClaimPath } from "@/lib/customers/card-qr";

export function CustomerWalletQrDelivery({ cardToken, qrDataUrl, repeatDelivery = false }: { cardToken: string; qrDataUrl: string | null; repeatDelivery?: boolean }) {
  return <section className="operations-wallet-delivery" aria-labelledby="wallet-delivery-title">
    <div><p>Entrega digital</p><h3 id="wallet-delivery-title">{repeatDelivery ? "Volver a entregar tarjeta importada" : "La tarjeta aún no está agregada a Wallet"}</h3><span>{repeatDelivery ? "Puedes mostrar nuevamente el QR aunque Wallet haya registrado una instalación anterior." : "Genera un QR para que el cliente la agregue desde su teléfono."}</span></div>
    <details>
      <summary className="operations-secondary-button">Generar QR para agregar tarjeta</summary>
      <div className="operations-wallet-delivery-qr">
        {qrDataUrl ? <img alt="Código QR para que el cliente agregue su tarjeta" height="220" src={qrDataUrl} width="220" /> : <p role="alert">No se pudo generar el QR en este dominio.</p>}
        <p>El cliente revisará y aceptará los términos antes de agregar la tarjeta.</p>
        <a href={customerCardClaimPath(cardToken)}>Abrir entrega en este dispositivo</a>
      </div>
    </details>
  </section>;
}
