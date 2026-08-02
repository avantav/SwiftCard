import { PublicWalletCard, type PublicCard } from "@/components/public-wallet-card";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CardPageProps = { params: Promise<{ cardToken: string }> };

export default async function CardPage({ params }: CardPageProps) {
  const { cardToken } = await params;
  let card: PublicCard | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.schema("app").rpc("get_public_web_card", { target_card_token: cardToken });
    card = Array.isArray(data) && data[0] ? data[0] : null;
  } catch { card = null; }
  if (card) return <PublicWalletCard card={card} />;
  return <main className="public-shell"><div className="public-auth-layout"><SwiftWalletBrand /><section className="public-card public-unavailable-card"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h1>Tarjeta no disponible</h1><p>El enlace es inválido, fue revocado o la tarjeta ya no está activa.</p></section></div></main>;
}
