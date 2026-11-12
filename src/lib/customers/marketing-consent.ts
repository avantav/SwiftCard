import type { SupabaseClient } from "@supabase/supabase-js";

export const MARKETING_CONSENT_FIELD = "marketingConsent";

export function readMarketingConsent(formData: FormData) {
  return formData.get(MARKETING_CONSENT_FIELD) === "on";
}

/**
 * Records the optional marketing consent through the issued card capability.
 * Only an explicit opt-in is stored; the default (no consent) needs no call.
 * Never throws: consent capture must not break registration.
 */
export async function recordMarketingConsentBestEffort(
  client: SupabaseClient,
  cardToken: string,
  consent: boolean,
) {
  if (!consent) return "NOT_REQUESTED" as const;
  try {
    const { data, error } = await client.schema("app").rpc("set_card_marketing_consent", {
      target_card_token: cardToken,
      target_consent: true,
    });
    if (error || data !== "UPDATED") {
      console.error("[marketing-consent]", {
        code: (error as { code?: string } | null)?.code ?? String(data ?? "UNKNOWN"),
      });
      return "FAILED" as const;
    }
    return "RECORDED" as const;
  } catch {
    console.error("[marketing-consent]", { code: "EXCEPTION" });
    return "FAILED" as const;
  }
}
