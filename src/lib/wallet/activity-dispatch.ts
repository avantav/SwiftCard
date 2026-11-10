import "server-only";

import { dispatchAppleWalletUpdatesBestEffort } from "./apple-apns";
import { dispatchGoogleWalletActivity } from "./google-activity";

/**
 * Best-effort Wallet delivery after a confirmed purchase or redemption. Apple
 * drains its existing outbox (the pass carries the activity message); Google is
 * refreshed and messaged directly. Failures never surface to the operation.
 */
export async function dispatchWalletActivityBestEffort(options: { customerId?: string | null }) {
  const customerId = options.customerId ?? undefined;
  const [apple, google] = await Promise.all([
    dispatchAppleWalletUpdatesBestEffort({ limit: 1, customerId }),
    customerId
      ? dispatchGoogleWalletActivity({ customerId }).catch((error: unknown) => {
          console.error("[google-wallet-activity-dispatch]", {
            message: error instanceof Error ? error.message.slice(0, 200) : "Unknown dispatch error",
          });
          return null;
        })
      : Promise.resolve(null),
  ]);
  return { apple, google };
}
