import "server-only";

import { emailConfig, sendEmail } from "@/lib/email/resend";
import { renderCampaignEmail } from "@/lib/email/templates";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingAppleWalletUpdates } from "@/lib/wallet/apple-apns";
import { truncateWalletText, WALLET_ACTIVITY_TITLE_MAX_LENGTH } from "@/lib/wallet/activity-message";
import { loadGoogleWalletPassSource } from "@/lib/wallet/google-pass-source";
import { addGoogleWalletMessage, syncGoogleWalletPass } from "@/lib/wallet/google-server";
import { walletProviderConfig } from "@/lib/wallet/service";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RecipientRow = {
  id: string;
  channel: "EMAIL" | "APPLE" | "GOOGLE";
  wallet_pass_id: string | null;
  customers: { full_name: string; email: string | null; marketing_consent: boolean } | null;
  customer_cards: {
    public_token: string;
    loyalty_cards: { background_color: string | null; logo_image_url: string | null } | null;
  } | null;
};

export type CampaignDeliveryResult = { sent: number; failed: number; pending: number };

const BATCH = 5;

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function shortError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

async function mark(db: AdminClient, id: string, status: "SENT" | "FAILED" | "SKIPPED", detail: { providerId?: string | null; error?: string | null } = {}) {
  await db
    .from("marketing_campaign_recipients")
    .update({ status, provider_message_id: detail.providerId ?? null, last_error: detail.error ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "PENDING");
}

/**
 * Sends every PENDING recipient of a campaign. Safe to call again: email uses
 * an idempotency key per recipient, Google a fixed message id per campaign and
 * Apple the durable update outbox. Never throws.
 */
export async function deliverCampaign(campaignId: string): Promise<CampaignDeliveryResult> {
  const result: CampaignDeliveryResult = { sent: 0, failed: 0, pending: 0 };
  try {
    const db = createSupabaseAdminClient();
    const { data: campaign } = await db
      .from("marketing_campaigns")
      .select("id,tenant_id,email_subject,email_body,wallet_message,tenants!inner(name,logo_url,branding_mode,status)")
      .eq("id", campaignId)
      .maybeSingle();
    const tenant = one(campaign?.tenants as never) as { name: string; logo_url: string | null; branding_mode: string; status: string } | null;
    if (!campaign || !tenant || tenant.status !== "ACTIVE") return result;

    const origin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
    const { data: rows } = await db
      .from("marketing_campaign_recipients")
      .select("id,channel,wallet_pass_id,customers!inner(full_name,email,marketing_consent),customer_cards!inner(public_token,loyalty_cards(background_color,logo_image_url))")
      .eq("campaign_id", campaignId)
      .eq("status", "PENDING")
      .limit(20000);
    const recipients = (rows ?? []) as unknown as RecipientRow[];

    const emailRows = recipients.filter((row) => row.channel === "EMAIL");
    const googleRows = recipients.filter((row) => row.channel === "GOOGLE");
    const appleRows = recipients.filter((row) => row.channel === "APPLE");

    // Email
    const canEmail = Boolean(origin?.startsWith("https://")) && emailConfig().configured;
    for (let index = 0; index < emailRows.length; index += BATCH) {
      await Promise.all(emailRows.slice(index, index + BATCH).map(async (row) => {
        const customer = one(row.customers);
        const card = one(row.customer_cards);
        const email = customer?.email?.trim();
        if (!customer?.marketing_consent || !email || !card) {
          await mark(db, row.id, "SKIPPED", { error: "Sin consentimiento o sin correo." });
          return;
        }
        if (!canEmail) {
          result.pending += 1;
          return;
        }
        const design = one(card.loyalty_cards);
        const token = encodeURIComponent(card.public_token);
        const rendered = renderCampaignEmail({
          brand: {
            tenantName: tenant.name,
            logoUrl: design?.logo_image_url ?? tenant.logo_url,
            backgroundColor: design?.background_color ?? "#10253D",
            showMorrowAttribution: tenant.branding_mode !== "WHITE_LABEL"
          },
          customerName: customer.full_name,
          subject: campaign.email_subject ?? "",
          body: campaign.email_body ?? "",
          cardUrl: `${origin}/card/${token}`,
          unsubscribeUrl: `${origin}/card/${token}/promociones`
        });
        const sent = await sendEmail({
          to: email,
          fromName: tenant.name,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          idempotencyKey: `campaign:${row.id}`
        });
        if (sent.ok) {
          result.sent += 1;
          await mark(db, row.id, "SENT", { providerId: sent.providerMessageId });
        } else {
          result.failed += 1;
          await mark(db, row.id, "FAILED", { error: sent.error });
        }
      }));
    }

    // Google Wallet
    const canGoogle = walletProviderConfig("GOOGLE").configured && Boolean(process.env.SWIFTWALLET_PUBLIC_URL?.trim());
    for (const row of googleRows) {
      const card = one(row.customer_cards);
      if (!one(row.customers)?.marketing_consent || !card) {
        await mark(db, row.id, "SKIPPED", { error: "Sin consentimiento." });
        continue;
      }
      if (!canGoogle) {
        result.pending += 1;
        continue;
      }
      try {
        const loaded = await loadGoogleWalletPassSource(card.public_token, process.env.SWIFTWALLET_PUBLIC_URL!.trim());
        if (!loaded.ok) {
          await mark(db, row.id, "SKIPPED", { error: "Pase de Google no disponible." });
          continue;
        }
        const synced = await syncGoogleWalletPass(loaded.source.passData, { notifyOnUpdate: false });
        const delivery = await addGoogleWalletMessage(synced.objectId, {
          id: `campaign-${campaignId}`,
          header: truncateWalletText(tenant.name, WALLET_ACTIVITY_TITLE_MAX_LENGTH),
          body: campaign.wallet_message ?? ""
        });
        result.sent += 1;
        await mark(db, row.id, "SENT", { providerId: delivery });
      } catch (error) {
        result.failed += 1;
        await mark(db, row.id, "FAILED", { error: shortError(error) });
      }
    }

    // Apple Wallet: the passes were queued when the campaign was created.
    if (appleRows.length) {
      if (walletProviderConfig("APPLE").configured) {
        for (let round = 0; round < Math.ceil(appleRows.length / 50) + 2; round += 1) {
          const drained = await dispatchPendingAppleWalletUpdates({ limit: 50 });
          if (!drained.claimed) break;
        }
      }
      const passIds = appleRows.map((row) => row.wallet_pass_id).filter((id): id is string => Boolean(id));
      const queued = new Set<string>();
      for (let index = 0; index < passIds.length; index += 200) {
        const { data: stillQueued } = await db
          .from("apple_wallet_update_outbox")
          .select("wallet_pass_id")
          .in("wallet_pass_id", passIds.slice(index, index + 200));
        for (const item of stillQueued ?? []) queued.add(item.wallet_pass_id);
      }
      for (const row of appleRows) {
        if (row.wallet_pass_id && queued.has(row.wallet_pass_id)) {
          result.pending += 1;
        } else {
          result.sent += 1;
          await mark(db, row.id, "SENT", { providerId: "APNS" });
        }
      }
    }

    const { count } = await db
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "PENDING");
    if (!count) {
      await db.from("marketing_campaigns").update({ status: "SENT", completed_at: new Date().toISOString() }).eq("id", campaignId);
    }
  } catch (error) {
    console.error("[campaign-delivery]", { message: shortError(error).slice(0, 200) });
  }
  return result;
}
