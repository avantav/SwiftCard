import "server-only";

import type { AppleStoreCardPreviewDesign } from "@/components/apple-store-card-preview";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegistrationCard = {
  id: string;
  name: string;
  description: string;
  design: AppleStoreCardPreviewDesign;
  programName: string;
  programVersion: number;
  terms: string;
  programType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  rewardGoal: number | null;
  unitNameSingular: string;
  unitNamePlural: string;
};

export type PublicRegistrationContext = {
  branchName: string;
  tenantName: string;
  brandingMode: string;
  cards: RegistrationCard[];
};

export async function getPublicRegistrationContext(branchToken: string) {
  if (!branchToken || branchToken.length > 256) return null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,tenant_id,name,status")
      .eq("public_registration_token", branchToken)
      .maybeSingle();
    if (branchError || !branch || branch.status !== "ACTIVE") return null;

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name,status,branding_mode,logo_url,banner_url")
      .eq("id", branch.tenant_id)
      .maybeSingle();
    if (tenantError || !tenant || tenant.status !== "ACTIVE") return null;

    const { data: assignments, error: assignmentsError } = await supabase
      .from("loyalty_card_branches")
      .select("loyalty_card_id")
      .eq("branch_id", branch.id);
    if (assignmentsError) return null;
    const cardIds = (assignments ?? []).map((item) => item.loyalty_card_id);
    const { data: cards, error: cardsError } = cardIds.length
      ? await supabase
          .from("loyalty_cards")
          .select("id,name,description,program_id,logo_text,background_color,foreground_color,label_color,logo_image_url,strip_image_url,logo_scale_percent,logo_margin_x_percent,logo_margin_y_percent,strip_scale_percent,strip_margin_x_percent,strip_margin_y_percent,strip_dimming_enabled,strip_stamps_enabled,stamp_icon_url,stamp_empty_slots_enabled,stamp_row_counts,stamp_position_x_percent,stamp_position_y_percent")
          .eq("tenant_id", branch.tenant_id)
          .in("id", cardIds)
          .eq("status", "PUBLISHED")
          .order("name")
      : { data: [], error: null };
    if (cardsError || !cards?.length) return null;

    const programIds = cards.map((card) => card.program_id);
    const [programs, tiers] = await Promise.all([
      supabase.from("loyalty_programs")
        .select("id,name,version,terms_and_conditions,program_type,unit_name_singular,unit_name_plural")
        .eq("tenant_id", branch.tenant_id).in("id", programIds),
      supabase.from("loyalty_reward_tiers").select("program_id,stamps_required")
        .eq("tenant_id", branch.tenant_id).in("program_id", programIds).eq("active", true),
    ]);
    if (programs.error || tiers.error) return null;
    const publicCards: RegistrationCard[] = cards.flatMap((card) => {
      const program = programs.data?.find((item) => item.id === card.program_id);
      if (!program) return [];
      return [{
        id: card.id, name: card.name, description: card.description,
        programName: program.name, programVersion: program.version, terms: program.terms_and_conditions, programType: program.program_type,
        unitNameSingular: program.unit_name_singular, unitNamePlural: program.unit_name_plural,
        rewardGoal: Math.max(0, ...(tiers.data ?? []).filter((tier) => tier.program_id === program.id).map((tier) => Number(tier.stamps_required))) || null,
        design: {
          logoText: card.logo_text ?? "", backgroundColor: card.background_color,
          foregroundColor: card.foreground_color, labelColor: card.label_color,
          logoImageUrl: card.logo_image_url ?? tenant.logo_url ?? "",
          stripImageUrl: card.strip_image_url ?? tenant.banner_url ?? "",
          logoScalePercent: card.logo_scale_percent ?? 100,
          logoMarginXPercent: card.logo_margin_x_percent ?? 0,
          logoMarginYPercent: card.logo_margin_y_percent ?? 0,
          stripScalePercent: card.strip_scale_percent ?? 100,
          stripMarginXPercent: card.strip_margin_x_percent ?? 0,
          stripMarginYPercent: card.strip_margin_y_percent ?? 0,
          stripDimmingEnabled: card.strip_dimming_enabled ?? true,
          stripStampsEnabled: card.strip_stamps_enabled ?? true,
          stampIconUrl: card.stamp_icon_url ?? "",
          stampEmptySlotsEnabled: card.stamp_empty_slots_enabled ?? true,
          stampRowCounts: card.stamp_row_counts ?? [],
          stampPositionXPercent: card.stamp_position_x_percent ?? 50,
          stampPositionYPercent: card.stamp_position_y_percent ?? 50,
        },
      }];
    });
    if (!publicCards.length) return null;
    return {
      branchName: branch.name,
      tenantName: tenant.name,
      brandingMode: tenant.branding_mode,
      cards: publicCards,
    } satisfies PublicRegistrationContext;
  } catch {
    return null;
  }
}
