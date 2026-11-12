import "server-only";

import { sendRewardEmailsBestEffort } from "@/lib/email/customer-emails";
import { dispatchAppleWalletUpdatesBestEffort } from "./apple-apns";
import { dispatchGoogleWalletActivity } from "./google-activity";

/**
 * Best-effort customer notifications after a confirmed purchase or redemption:
 * Apple drains its outbox (the pass carries the activity message), Google is
 * refreshed and messaged directly, and a purchase that unlocked rewards sends
 * the reward email. Failures never surface to the operation.
 */
export async function dispatchCustomerActivityBestEffort(options: { customerId?: string | null }) {
  const customerId = options.customerId ?? undefined;
  const [apple, google, emails] = await Promise.all([
    dispatchAppleWalletUpdatesBestEffort({ limit: 1, customerId }),
    customerId
      ? dispatchGoogleWalletActivity({ customerId }).catch((error: unknown) => {
          console.error("[google-wallet-activity-dispatch]", {
            message: error instanceof Error ? error.message.slice(0, 200) : "Unknown dispatch error",
          });
          return null;
        })
      : Promise.resolve(null),
    sendRewardEmailsBestEffort(customerId),
  ]);
  return { apple, google, emails };
}
