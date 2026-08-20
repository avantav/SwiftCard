/* QR data URLs are generated locally and cannot use the Next image optimizer. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createCustomerCardClaimQrDataUrl, customerCardClaimPath } from "@/lib/customers/card-qr";

export async function EmployeeRegistrationHandoff({ cardToken, origin }: { cardToken: string; origin: string | null }) {
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = origin ? await createCustomerCardClaimQrDataUrl(origin, cardToken) : null;
  } catch {
    qrDataUrl = null;
  }

  return <section className="operations-card operations-handoff" aria-labelledby="handoff-title">
    <div className="operations-handoff-success" aria-hidden="true">✓</div>
    <div className="operations-card-header"><p>Cliente registrado</p><h2 id="handoff-title">Entrega su tarjeta</h2><span>Pide al cliente que escanee este QR con la cámara de su teléfono.</span></div>
    <div className="operations-handoff-qr" aria-label="QR para aceptar términos y agregar la tarjeta">
      {qrDataUrl ? <img alt="Código QR para entregar la tarjeta al cliente" height="240" src={qrDataUrl} width="240" /> : <p role="alert">No se pudo preparar el QR. Abre la entrega en este dispositivo.</p>}
    </div>
    <ol className="operations-handoff-steps"><li>Escanear el QR.</li><li>Revisar y aceptar los términos.</li><li>Agregar la tarjeta al teléfono.</li></ol>
    <a className="operations-secondary-button" href={customerCardClaimPath(cardToken)}>Abrir entrega en este dispositivo</a>
    <Link className="operations-primary-button" href="/app">Registrar otro cliente</Link>
  </section>;
}
