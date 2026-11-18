import "server-only";

import { buildSetupChecklist, type SetupChecklist } from "@/lib/admin/onboarding";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Loads the setup checklist with the session client, so RLS scopes every
 * count to the admin's own tenant. The tenant comes from the server session
 * context, never from the request. Returns null when a count fails.
 */
export async function loadSetupChecklist(supabase: ServerClient, tenantId: string): Promise<SetupChecklist | null> {
  const [tenant, branches, cards, staff] = await Promise.all([
    supabase.from("tenants").select("legal_name,legal_address").eq("id", tenantId).maybeSingle(),
    supabase.from("branches").select("latitude,longitude").eq("tenant_id", tenantId).eq("status", "ACTIVE"),
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "PUBLISHED"),
    supabase.from("staff_profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("role", ["MANAGER", "EMPLOYEE"]),
  ]);
  if (tenant.error || branches.error || cards.error || staff.error) return null;
  const activeBranches = branches.data ?? [];
  return buildSetupChecklist({
    legalComplete: Boolean(tenant.data?.legal_name && tenant.data?.legal_address),
    activeBranches: activeBranches.length,
    branchesWithoutLocation: activeBranches.filter((branch) => branch.latitude === null || branch.longitude === null).length,
    publishedCards: cards.count ?? 0,
    staffMembers: staff.count ?? 0,
  });
}
