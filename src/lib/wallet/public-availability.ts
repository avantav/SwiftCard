import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { walletProviderConfig } from "@/lib/wallet/service";

export async function isPublicAppleWalletAvailable(cardToken: string) {
  return isPublicWalletAvailable(cardToken, "APPLE");
}

export async function isPublicGoogleWalletAvailable(cardToken: string) {
  return isPublicWalletAvailable(cardToken, "GOOGLE");
}

async function isPublicWalletAvailable(
  cardToken: string,
  provider: "APPLE" | "GOOGLE",
) {
  if (
    !cardToken ||
    cardToken.length > 256 ||
    !walletProviderConfig(provider).configured
  ) {
    return false;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("app")
      // This legacy RPC name checks the provider-neutral wallet_enabled flag.
      .rpc("public_apple_wallet_is_enabled", {
        target_card_token: cardToken,
      });
    return !error && data === true;
  } catch {
    return false;
  }
}
