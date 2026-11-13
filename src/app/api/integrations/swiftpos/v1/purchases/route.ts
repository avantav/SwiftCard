import { apiKeyHashFromHeader } from "@/lib/integrations/swiftpos/api-key";
import { apiError, apiJson, logIntegrationError, readJsonBody } from "@/lib/integrations/swiftpos/http";
import { errorFromDatabaseResult, parsePurchaseRequest } from "@/lib/integrations/swiftpos/requests";
import { scanTicketSecret, verifyScanTicket } from "@/lib/integrations/swiftpos/scan-ticket";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchCustomerActivityBestEffort } from "@/lib/wallet/activity-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PurchaseRow = {
  result: string;
  purchase_id: string | null;
  stamps_awarded: number;
  rewards_generated: number;
  balance: number | null;
  customer_id: string | null;
};

/** Records a SwiftPOS sale (DEC-0071). Retries with the same sale are idempotent. */
export async function POST(request: Request) {
  const keyHash = apiKeyHashFromHeader(request.headers.get("authorization"));
  if (!keyHash) return apiError("UNAUTHORIZED");
  const secret = scanTicketSecret();
  if (!secret) return apiError("NOT_CONFIGURED");
  const parsed = parsePurchaseRequest(await readJsonBody(request));
  if (!parsed.ok) return apiError("INVALID_REQUEST");
  const ticket = verifyScanTicket(parsed.data.scanTicket, secret);
  if (!ticket.ok) return apiError(ticket.reason === "EXPIRED" ? "SCAN_TICKET_EXPIRED" : "SCAN_TICKET_INVALID");

  const supabase = createSupabaseAdminClient();
  try {
    const { data, error } = await supabase.schema("app").rpc("integration_confirm_purchase", {
      target_key_hash: keyHash,
      target_external_store_id: parsed.data.storeId,
      target_customer_card_id: ticket.claims.customerCardId,
      target_expected_integration_id: ticket.claims.integrationId,
      target_expected_branch_id: ticket.claims.branchId,
      target_external_sale_id: parsed.data.externalSaleId,
      target_ticket_number: parsed.data.ticketNumber,
      target_amount_minor: parsed.data.amountMinor,
      target_occurred_at: parsed.data.occurredAt,
      target_operator_id: parsed.data.cashier.id,
      target_operator_name: parsed.data.cashier.name,
      target_latitude: parsed.data.location?.latitude ?? null,
      target_longitude: parsed.data.location?.longitude ?? null
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : null) as PurchaseRow | null;
    if (!row || (row.result !== "CONFIRMED" && row.result !== "ALREADY_RECORDED")) {
      return apiError(errorFromDatabaseResult(row?.result));
    }

    if (row.result === "CONFIRMED" && row.customer_id) {
      await notifyCustomerBestEffort(supabase, keyHash, row.customer_id);
    }

    return apiJson({
      result: row.result,
      stampsAwarded: row.stamps_awarded,
      rewardsGenerated: row.rewards_generated,
      balance: row.balance
    });
  } catch (error) {
    logIntegrationError("purchases", error);
    return apiError("SERVICE_UNAVAILABLE");
  }
}

/** Wallet and reward emails, unless the wallet_refresh switch is stopped. Never fails the purchase. */
async function notifyCustomerBestEffort(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  keyHash: string,
  customerId: string
) {
  try {
    const { data } = await supabase.schema("app").rpc("integration_status", { target_key_hash: keyHash });
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.result === "OK" && row.modules?.["swiftpos_integration.wallet_refresh"] === true) {
      await dispatchCustomerActivityBestEffort({ customerId });
    }
  } catch (error) {
    logIntegrationError("purchases/notify", error);
  }
}
