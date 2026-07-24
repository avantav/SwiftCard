import { createSupabaseServerClient } from "@/lib/supabase/server";

type CardPageProps = {
  params: Promise<{
    cardToken: string;
  }>;
};

export default async function CardPage({ params }: CardPageProps) {
  const { cardToken } = await params;
  let card: {
    tenant_name: string;
    branding_mode: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    customer_name: string;
  } | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.rpc("get_public_web_card", { target_card_token: cardToken });
    card = Array.isArray(data) && data[0] ? data[0] : null;
  } catch {
    card = null;
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="card-title">
        {card?.logo_url ? <img className="card-logo" src={card.logo_url} alt={card.tenant_name} /> : null}
        <p className="eyebrow">{card?.tenant_name ?? "SwiftWallet"}</p>
        <h1 id="card-title" className="auth-title">{card ? "Tarjeta digital" : "Tarjeta no disponible"}</h1>
        {card ? (
          <>
            <p className="card-customer">{card.customer_name}</p>
            <div className="card-qr-placeholder" aria-label="QR de la tarjeta">QR</div>
            <p className="body-copy">Presenta esta tarjeta en las sucursales participantes.</p>
          </>
        ) : <p className="body-copy">El enlace es inválido, fue revocado o ya no está disponible.</p>}
      </section>
    </main>
  );
}
