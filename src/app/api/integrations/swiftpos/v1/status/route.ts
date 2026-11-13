import { apiKeyHashFromHeader } from "@/lib/integrations/swiftpos/api-key";
import { apiError, apiJson, logIntegrationError } from "@/lib/integrations/swiftpos/http";
import { errorFromDatabaseResult } from "@/lib/integrations/swiftpos/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Effective SwiftCard modules for the key's tenant, so SwiftPOS can show both sides. */
export async function GET(request: Request) {
  const keyHash = apiKeyHashFromHeader(request.headers.get("authorization"));
  if (!keyHash) return apiError("UNAUTHORIZED");
  try {
    const { data, error } = await createSupabaseAdminClient().schema("app").rpc("integration_status", {
      target_key_hash: keyHash
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || row.result !== "OK") return apiError(errorFromDatabaseResult(row?.result));
    return apiJson({ modules: row.modules });
  } catch (error) {
    logIntegrationError("status", error);
    return apiError("SERVICE_UNAVAILABLE");
  }
}
