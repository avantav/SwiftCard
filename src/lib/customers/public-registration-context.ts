import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicRegistrationContext = {
  branchName: string;
  tenantName: string;
  cards: Array<{ id: string; name: string; description: string }>;
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
      .select("name,status")
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
          .select("id,name,description")
          .in("id", cardIds)
          .eq("status", "PUBLISHED")
          .order("name")
      : { data: [], error: null };
    if (cardsError || !cards?.length) return null;

    return {
      branchName: branch.name,
      tenantName: tenant.name,
      cards,
    } satisfies PublicRegistrationContext;
  } catch {
    return null;
  }
}
