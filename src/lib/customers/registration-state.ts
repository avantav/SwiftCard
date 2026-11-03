import type { CustomerCardClaimData } from "@/components/customer-card-claim";
import type { PublicCard } from "@/components/public-wallet-card";

export type RegistrationState = {
  error?: string;
  cardToken?: string;
  claim?: CustomerCardClaimData;
  card?: PublicCard;
  qrDataUrl?: string;
  accepted?: boolean;
  appleWalletAvailable?: boolean;
  googleWalletAvailable?: boolean;
};
