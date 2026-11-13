import { openPublicCardScanToken } from "@/lib/customers/card-scan-server";
import { apiKeyHashFromHeader } from "@/lib/integrations/swiftpos/api-key";
import { apiError, apiJson, logIntegrationError, readJsonBody } from "@/lib/integrations/swiftpos/http";
import { errorFromDatabaseResult, parseResolveRequest } from "@/lib/integrations/swiftpos/requests";
import { scanTicketSecret, signScanTicket } from "@/lib/integrations/swiftpos/scan-ticket";
import { parseCardQrPayload } from "@/lib/scanner/qr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResolveRow = {
  result: string;
  integration_id: string | null;
  branch_id: string | null;
  customer_card_id: string | null;
  first_name: string | null;
  card_name: string | null;
  program_type: string | null;
  balance: number | null;
  unit_name_singular: string | null;
  unit_name_plural: string | null;
  available_rewards: number | null;
};

/** Identifies the customer from the scanned card QR (DEC-0071). */
export async function POST(request: Request) {
  const keyHash = apiKeyHashFromHeader(request.headers.get("authorization"));
  if (!keyHash) return apiError("UNAUTHORIZED");
  const secret = scanTicketSecret();
  if (!secret) return apiError("NOT_CONFIGURED");
  const parsed = parseResolveRequest(await readJsonBody(request));
  if (!parsed.ok) return apiError("INVALID_REQUEST");

  const qr = parseCardQrPayload(parsed.data.scan);
  const cardToken = qr.ok ? (qr.publicScan ? openPublicCardScanToken(qr.cardToken) : qr.cardToken) : null;

  try {
    const { data, error } = await createSupabaseAdminClient().schema("app").rpc("integration_resolve_card", {
      target_key_hash: keyHash,
      target_external_store_id: parsed.data.storeId,
      // An unreadable QR still authenticates and counts against the rate limit.
      target_card_token: cardToken ?? ""
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : null) as ResolveRow | null;
    if (!row || row.result !== "FOUND" || !row.customer_card_id || !row.integration_id || !row.branch_id) {
      return apiError(errorFromDatabaseResult(row?.result));
    }
    return apiJson({
      scanTicket: signScanTicket({
        customerCardId: row.customer_card_id,
        integrationId: row.integration_id,
        branchId: row.branch_id
      }, secret),
      customer: { firstName: row.first_name },
      card: {
        name: row.card_name,
        programType: row.program_type,
        balance: row.balance,
        unit: { singular: row.unit_name_singular, plural: row.unit_name_plural },
        availableRewards: row.available_rewards
      }
    });
  } catch (error) {
    logIntegrationError("cards/resolve", error);
    return apiError("SERVICE_UNAVAILABLE");
  }
}
