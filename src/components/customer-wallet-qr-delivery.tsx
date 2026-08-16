/* QR data URLs are generated locally and cannot use the Next image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { customerCardClaimPath } from "@/lib/customers/card-qr";

export function CustomerWalletQrDelivery({ cardToken, qrDataUrl }: { cardToken: string; qrDataUrl: string | null }) {
  return <section className="operations-wallet-delivery" aria-labelledby="wallet-delivery-title">
    <div><p>Entrega digital</p><h3 id="wallet-delivery-title">La tarjeta aún no está agregada a Wallet</h3><span>Genera un QR para que el cliente la agregue desde su teléfono.</span></div>
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
