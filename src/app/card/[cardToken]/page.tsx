import { PublicWalletCard, type PublicCard } from "@/components/public-wallet-card";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { walletProviderConfig } from "@/lib/wallet/service";

type CardPageProps = { params: Promise<{ cardToken: string }> };

export default async function CardPage({ params }: CardPageProps) {
  const { cardToken } = await params;
  let card: PublicCard | null = null;
  let appleWalletAvailable = false;
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data }, availability] = await Promise.all([
      supabase.schema("app").rpc("get_public_web_card", { target_card_token: cardToken }),
      walletProviderConfig("APPLE").configured
        ? supabase.schema("app").rpc("public_apple_wallet_is_enabled", { target_card_token: cardToken })
        : Promise.resolve({ data: false, error: null }),
    ]);
    card = Array.isArray(data) && data[0] ? data[0] : null;
    appleWalletAvailable = availability.data === true;
  } catch { card = null; }
  if (card) return <PublicWalletCard appleWalletAvailable={appleWalletAvailable} card={card} cardToken={cardToken} />;
  return <main className="public-shell"><div className="public-auth-layout"><SwiftWalletBrand /><section className="public-card public-unavailable-card"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h1>Tarjeta no disponible</h1><p>El enlace es inválido, fue revocado o la tarjeta ya no está activa.</p></section></div></main>;
}
