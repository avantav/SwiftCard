import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MorrowBrand } from "@/components/morrow-brand";
import { SubmitButton } from "@/components/submit-button";
import { isCustomerCardToken } from "@/lib/customers/card-qr";
import { stopPromotions } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promociones · morrow",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

type PromotionsPageProps = {
  params: Promise<{ cardToken: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
};

export default async function PromotionsPage({ params, searchParams }: PromotionsPageProps) {
  const { cardToken } = await params;
  const query = await searchParams;
  if (!isCustomerCardToken(cardToken)) notFound();
  const action = stopPromotions.bind(null, cardToken);

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
        <MorrowBrand subtitle="Tu tarjeta de lealtad" />
        <section className="public-card" aria-labelledby="promotions-title">
          <h1 id="promotions-title" className="auth-title">Promociones</h1>
          {query.done ? (
            <p className="enterprise-alert is-success" role="status">
              Listo. Ya no recibirás promociones por correo ni avisos de campañas en tu tarjeta. Seguirás recibiendo los avisos de tus compras y premios.
            </p>
          ) : (
            <>
              {query.error ? <p className="enterprise-alert is-error" role="alert">No pudimos actualizar tu preferencia. Intenta de nuevo.</p> : null}
              <p className="public-card-copy">
                Si ya no quieres recibir promociones de este negocio por correo ni avisos de campañas en tu tarjeta de Wallet, confírmalo aquí. Tu tarjeta, tus puntos y tus premios no cambian.
              </p>
              <form action={action}>
                <SubmitButton className="public-primary-button">Dejar de recibir promociones</SubmitButton>
              </form>
            </>
          )}
          <p className="public-card-copy">
            <Link href={`/card/${encodeURIComponent(cardToken)}`}>Ver mi tarjeta</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
