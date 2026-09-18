import { CustomerCardClaim, type CustomerCardClaimData } from "@/components/customer-card-claim";
import { PublicWalletCard, type PublicCard } from "@/components/public-wallet-card";
import { MorrowBrand } from "@/components/morrow-brand";
import { createCustomerCardQrDataUrl } from "@/lib/customers/card-qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPublicAppleWalletAvailable, isPublicGoogleWalletAvailable } from "@/lib/wallet/public-availability";
import { acceptCardTerms } from "./actions";

type CardPageProps = { params: Promise<{ cardToken: string }>; searchParams: Promise<{ claim?: string; error?: string }> };

export default async function CardPage({ params, searchParams }: CardPageProps) {
  const { cardToken } = await params;
  const query = await searchParams;
  let card: PublicCard | null = null;
  let claimCard: CustomerCardClaimData | null = null;
  let claimAccepted = false;
  let claimAppleWalletAvailable = false;
  let claimGoogleWalletAvailable = false;
  let appleWalletAvailable = false;
  let googleWalletAvailable = false;
  let qrDataUrl: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    if (query.claim === "1") {
      const [{ data: claimData, error: claimError }, appleAvailability, googleAvailability, acceptance] = await Promise.all([
        supabase.schema("app").rpc("get_public_card_claim", { target_card_token: cardToken }),
        isPublicAppleWalletAvailable(cardToken),
        isPublicGoogleWalletAvailable(cardToken),
        supabase.schema("app").rpc("public_card_terms_are_accepted", { target_card_token: cardToken }),
      ]);
      claimCard = !claimError && Array.isArray(claimData) && claimData[0] ? claimData[0] as CustomerCardClaimData : null;
      claimAccepted = acceptance.data === true;
      claimAppleWalletAvailable = appleAvailability;
      claimGoogleWalletAvailable = googleAvailability;
    }
    const [{ data }, appleAvailability, googleAvailability] = await Promise.all([
      supabase.schema("app").rpc("get_public_web_card", { target_card_token: cardToken }),
      isPublicAppleWalletAvailable(cardToken),
      isPublicGoogleWalletAvailable(cardToken),
    ]);
    card = Array.isArray(data) && data[0] ? data[0] : null;
    appleWalletAvailable = appleAvailability;
    googleWalletAvailable = googleAvailability;
    if (card) {
      try {
        qrDataUrl = await createCustomerCardQrDataUrl(cardToken);
      } catch {
        qrDataUrl = null;
      }
    }
  } catch { card = null; }
  if (claimCard) {
    return <CustomerCardClaim
      accepted={claimAccepted}
      action={acceptCardTerms.bind(null, cardToken, claimCard.program_version)}
      appleWalletAvailable={claimAppleWalletAvailable}
      googleWalletAvailable={claimGoogleWalletAvailable}
      card={claimCard}
      cardToken={cardToken}
      error={query.error}
    />;
  }
  if (card) return <PublicWalletCard appleWalletAvailable={appleWalletAvailable} googleWalletAvailable={googleWalletAvailable} card={card} cardToken={cardToken} qrDataUrl={qrDataUrl} />;
  return <main className="public-shell"><div className="public-auth-layout"><MorrowBrand /><section className="public-card public-unavailable-card"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h1>Tarjeta no disponible</h1><p>El enlace es inválido, fue revocado o la tarjeta ya no está activa.</p></section></div></main>;
}
