import "server-only";

import { LEGAL_VERSION } from "@/lib/legal/company";
import { parseLegalConsentStatus, type LegalConsentStatus } from "@/lib/legal/consent";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Current staff member's acceptance of the platform legal documents
 * (DEC-0072). Returns null when nothing applies (Superadmin, locked shared
 * device) and also when the status cannot be read, so an outage of this check
 * never stops sales; the failure is logged without user data.
 */
export async function getLegalConsentStatus(supabase: ServerClient): Promise<LegalConsentStatus | null> {
  const { data, error } = await supabase.schema("app").rpc("get_my_legal_status", { required_version: LEGAL_VERSION });
  if (error) {
    console.error("legal consent status unavailable", error.code);
    return null;
  }
  return parseLegalConsentStatus(data);
}
