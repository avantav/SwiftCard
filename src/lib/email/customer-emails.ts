import "server-only";

import { resolvePublicOrigin } from "@/lib/public-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadLatestWalletActivity } from "@/lib/wallet/activity-source";
import { emailConfig, sendEmail } from "./resend";
import { renderRewardEmail, renderWelcomeEmail, type EmailBrand } from "./templates";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type EmailKind = "WELCOME" | "REWARD_UNLOCKED";

/** Reward emails only describe purchases confirmed moments ago. */
const REWARD_EVENT_MAX_AGE_MS = 15 * 60 * 1000;

type CardEmailContext = {
  tenantId: string;
  customerId: string;
  loyaltyCardId: string;
  email: string;
  customerName: string;
  cardUrl: string;
  brand: EmailBrand;
  programName: string;
  lifetimePoints: boolean;
  unitNameSingular: string;
  unitNamePlural: string;
  balance: number;
  rewardTiers: Array<{ stampsRequired: number; name: string }>;
};

function logEmailError(scope: string, error: unknown) {
  console.error(`[customer-email:${scope}]`, {
    message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
  });
}

function publicOrigin() {
  const origin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
  return origin?.startsWith("https://") ? origin : null;
}

async function loadCardEmailContext(
  db: AdminClient,
  card: { tenant_id: string; customer_id: string; loyalty_card_id: string | null; public_token: string },
): Promise<CardEmailContext | null> {
  const origin = publicOrigin();
  if (!origin || !card.loyalty_card_id) return null;

  const [customer, tenant, design, balance] = await Promise.all([
    db.from("customers").select("full_name,email,status")
      .eq("id", card.customer_id).eq("tenant_id", card.tenant_id).maybeSingle(),
    db.from("tenants").select("name,status,branding_mode,logo_url")
      .eq("id", card.tenant_id).maybeSingle(),
    db.from("loyalty_cards").select("id,program_id,status,background_color,logo_image_url")
      .eq("id", card.loyalty_card_id).eq("tenant_id", card.tenant_id).maybeSingle(),
    db.from("customer_loyalty_balances").select("stamp_balance,lifetime_points_tenths")
      .eq("customer_id", card.customer_id).eq("tenant_id", card.tenant_id).maybeSingle(),
  ]);
  const email = customer.data?.email?.trim();
  if (
    customer.error || tenant.error || design.error || balance.error
    || !customer.data || !tenant.data || !design.data
    || customer.data.status !== "ACTIVE" || tenant.data.status !== "ACTIVE"
    || !email || !/^\S+@\S+\.\S+$/.test(email)
  ) {
    return null;
  }

  const [program, tiers] = await Promise.all([
    db.from("loyalty_programs")
      .select("name,program_type,unit_name_singular,unit_name_plural")
      .eq("id", design.data.program_id).eq("tenant_id", card.tenant_id).maybeSingle(),
    db.from("loyalty_reward_tiers").select("stamps_required,name")
      .eq("tenant_id", card.tenant_id).eq("program_id", design.data.program_id)
      .eq("active", true).order("stamps_required"),
  ]);
  if (program.error || tiers.error || !program.data) return null;

  const lifetimePoints = program.data.program_type === "LIFETIME_POINTS";
  return {
    tenantId: card.tenant_id,
    customerId: card.customer_id,
    loyaltyCardId: card.loyalty_card_id,
    email,
    customerName: customer.data.full_name,
    cardUrl: `${origin}/card/${encodeURIComponent(card.public_token)}`,
    brand: {
      tenantName: tenant.data.name,
      logoUrl: design.data.logo_image_url ?? tenant.data.logo_url,
      backgroundColor: design.data.background_color,
      showMorrowAttribution: tenant.data.branding_mode !== "WHITE_LABEL",
    },
    programName: program.data.name,
    lifetimePoints,
    unitNameSingular: program.data.unit_name_singular,
    unitNamePlural: program.data.unit_name_plural,
    balance: lifetimePoints
      ? Math.floor(Number(balance.data?.lifetime_points_tenths ?? 0) / 10)
      : Number(balance.data?.stamp_balance ?? 0),
    rewardTiers: (tiers.data ?? []).map((tier) => ({
      stampsRequired: tier.stamps_required,
      name: tier.name,
    })),
  };
}

/** Reserves the logical email; returns null when it was already handled. */
async function claimDelivery(
  db: AdminClient,
  input: { tenantId: string; customerId: string; kind: EmailKind; eventKey: string },
) {
  const { data, error } = await db
    .from("customer_email_deliveries")
    .upsert(
      {
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        kind: input.kind,
        event_key: input.eventKey,
        status: "PENDING",
      },
      { onConflict: "tenant_id,event_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Unable to reserve email delivery: ${error.message}`);
  return data?.[0]?.id ?? null;
}

async function deliver(
  db: AdminClient,
  context: CardEmailContext,
  kind: EmailKind,
  eventKey: string,
  rendered: { subject: string; html: string; text: string },
) {
  const deliveryId = await claimDelivery(db, {
    tenantId: context.tenantId,
    customerId: context.customerId,
    kind,
    eventKey,
  });
  if (!deliveryId) return "ALREADY_HANDLED" as const;

  const result = await sendEmail({
    to: context.email,
    fromName: context.brand.tenantName,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: eventKey,
  });
  await db
    .from("customer_email_deliveries")
    .update(
      result.ok
        ? { status: "SENT", provider_message_id: result.providerMessageId, last_error: null }
        : { status: "FAILED", last_error: result.error.slice(0, 300) },
    )
    .eq("id", deliveryId);
  if (!result.ok) logEmailError(kind.toLowerCase(), result.error);
  return result.ok ? ("SENT" as const) : ("FAILED" as const);
}

function nextRewardText(context: CardEmailContext) {
  const next = context.rewardTiers.find((tier) => tier.stampsRequired > context.balance);
  if (!next) return null;
  const missing = next.stampsRequired - context.balance;
  const unit = missing === 1 ? context.unitNameSingular : context.unitNamePlural;
  return `Tu próximo premio: ${next.name}. Te ${missing === 1 ? "falta" : "faltan"} ${missing} ${unit}.`;
}

/**
 * Welcome email after a new card is issued. Includes the welcome reward when
 * the card grants one. Never throws: email problems never affect registration.
 */
export async function sendWelcomeEmailBestEffort(cardToken: string) {
  try {
    if (!emailConfig().configured) return "NOT_CONFIGURED" as const;
    const db = createSupabaseAdminClient();
    const { data: card, error } = await db
      .from("customer_cards")
      .select("id,tenant_id,customer_id,loyalty_card_id,public_token,status")
      .eq("public_token", cardToken)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (error || !card) return "SKIPPED" as const;

    const context = await loadCardEmailContext(db, card);
    if (!context) return "SKIPPED" as const;

    const { data: welcomeReward } = await db
      .from("rewards")
      .select("name")
      .eq("tenant_id", context.tenantId)
      .eq("customer_id", context.customerId)
      .eq("loyalty_card_id", context.loyaltyCardId)
      .eq("is_welcome_reward", true)
      .eq("status", "AVAILABLE")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const rendered = renderWelcomeEmail({
      brand: context.brand,
      customerName: context.customerName,
      programName: context.programName,
      cardUrl: context.cardUrl,
      unitNamePlural: context.unitNamePlural,
      welcomeRewardName: welcomeReward?.name ?? null,
      nextRewardText: nextRewardText(context),
    });
    return await deliver(db, context, "WELCOME", `welcome:${card.id}`, rendered);
  } catch (error) {
    logEmailError("welcome", error);
    return "FAILED" as const;
  }
}

/**
 * Reward email after a purchase that unlocked rewards, for each active card of
 * the customer. Idempotent per purchase. Never throws.
 */
export async function sendRewardEmailsBestEffort(customerId: string | null | undefined) {
  if (!customerId) return [];
  try {
    if (!emailConfig().configured) return [];
    const db = createSupabaseAdminClient();
    const { data: cards, error } = await db
      .from("customer_cards")
      .select("id,tenant_id,customer_id,loyalty_card_id,public_token,status")
      .eq("customer_id", customerId)
      .eq("status", "ACTIVE")
      .limit(10);
    if (error || !cards?.length) return [];

    const results = [];
    for (const card of cards) {
      if (!card.loyalty_card_id) continue;
      const context = await loadCardEmailContext(db, card);
      if (!context) continue;
      const activity = await loadLatestWalletActivity(db, {
        tenantId: context.tenantId,
        customerId: context.customerId,
        loyaltyCardId: context.loyaltyCardId,
        lifetimePoints: context.lifetimePoints,
      });
      if (
        activity.kind !== "PURCHASE"
        || activity.unlockedRewardNames.length === 0
        || Date.now() - Date.parse(activity.occurredAt) > REWARD_EVENT_MAX_AGE_MS
      ) {
        continue;
      }
      const rendered = renderRewardEmail({
        brand: context.brand,
        customerName: context.customerName,
        rewardNames: activity.unlockedRewardNames,
        cardUrl: context.cardUrl,
      });
      results.push(await deliver(db, context, "REWARD_UNLOCKED", `reward:${activity.id}`, rendered));
    }
    return results;
  } catch (error) {
    logEmailError("reward", error);
    return [];
  }
}
