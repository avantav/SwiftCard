import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { walletProviderConfig } from "@/lib/wallet/service";

export async function isPublicAppleWalletAvailable(cardToken: string) {
  if (
    !cardToken ||
    cardToken.length > 256 ||
    !walletProviderConfig("APPLE").configured
  ) {
    return false;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("app")
      .rpc("public_apple_wallet_is_enabled", {
        target_card_token: cardToken,
      });
    return !error && data === true;
  } catch {
    return false;
  }
}
