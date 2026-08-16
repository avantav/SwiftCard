import { CustomerCardClaim, type CustomerCardClaimData } from "@/components/customer-card-claim";
import { PublicWalletCard, type PublicCard } from "@/components/public-wallet-card";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { createCustomerCardQrDataUrl } from "@/lib/customers/card-qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPublicAppleWalletAvailable } from "@/lib/wallet/public-availability";
import { walletProviderConfig } from "@/lib/wallet/service";
import { acceptCardTerms } from "./actions";

type CardPageProps = { params: Promise<{ cardToken: string }>; searchParams: Promise<{ claim?: string; error?: string }> };

export default async function CardPage({ params, searchParams }: CardPageProps) {
  const { cardToken } = await params;
  const query = await searchParams;
  let card: PublicCard | null = null;
  let claimCard: CustomerCardClaimData | null = null;
  let claimAccepted = false;
  let claimAppleWalletAvailable = false;
  let appleWalletAvailable = false;
  let qrDataUrl: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    if (query.claim === "1") {
      const [{ data: claimData, error: claimError }, availability, acceptance] = await Promise.all([
        supabase.schema("app").rpc("get_public_card_claim", { target_card_token: cardToken }),
        isPublicAppleWalletAvailable(cardToken),
        supabase.schema("app").rpc("public_card_terms_are_accepted", { target_card_token: cardToken }),
      ]);
      claimCard = !claimError && Array.isArray(claimData) && claimData[0] ? claimData[0] as CustomerCardClaimData : null;
      claimAccepted = acceptance.data === true;
      claimAppleWalletAvailable = availability;
    }
    const [{ data }, availability] = await Promise.all([
      supabase.schema("app").rpc("get_public_web_card", { target_card_token: cardToken }),
      walletProviderConfig("APPLE").configured
        ? supabase.schema("app").rpc("public_apple_wallet_is_enabled", { target_card_token: cardToken })
        : Promise.resolve({ data: false, error: null }),
    ]);
    card = Array.isArray(data) && data[0] ? data[0] : null;
    appleWalletAvailable = availability.data === true;
    if (card) {
      try {
        qrDataUrl = await createCustomerCardQrDataUrl(cardToken);
      } catch {
        qrDataUrl = null;
      }
    }
  } catch { card = null; }
  if (claimCard) {
    const destination = claimAppleWalletAvailable ? "APPLE" as const : "WEB" as const;
    return <CustomerCardClaim
      accepted={claimAccepted}
      action={acceptCardTerms.bind(null, cardToken, claimCard.program_version, destination)}
      appleWalletAvailable={claimAppleWalletAvailable}
      card={claimCard}
      cardToken={cardToken}
      error={query.error}
    />;
  }
  if (card) return <PublicWalletCard appleWalletAvailable={appleWalletAvailable} card={card} cardToken={cardToken} qrDataUrl={qrDataUrl} />;
  return <main className="public-shell"><div className="public-auth-layout"><SwiftWalletBrand /><section className="public-card public-unavailable-card"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h1>Tarjeta no disponible</h1><p>El enlace es inválido, fue revocado o la tarjeta ya no está activa.</p></section></div></main>;
}
