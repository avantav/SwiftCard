import type { Metadata } from "next";
import { LocationReviewView, type LocationReviewBranch } from "@/components/location-review-view";
import { parseLocationReviewFilters, type LocationReviewRow } from "@/lib/admin/location-review";
import { requireInternalArea } from "@/lib/auth/server";
import { supportReadParams } from "@/lib/auth/support-read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguridad de ubicación · morrow"
};

type SecurityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LocationSecurityPage({ searchParams }: SecurityPageProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const filters = parseLocationReviewFilters(params);

  const hasFilters = Boolean(filters.branchId || filters.operatorKey || filters.result || params.from || params.to);
  const [reviewResult, branchesResult, tenantResult] = await Promise.all([
    context.supabase.schema("app").rpc("get_purchase_location_review", {
      target_from: filters.from,
      target_to: filters.to,
      target_branch_id: filters.branchId,
      target_operator_key: filters.operatorKey,
      target_result: filters.result,
      ...supportReadParams(context)
    }),
    context.supabase.from("branches").select("id,name,latitude,longitude,geofence_radius_meters").eq("tenant_id", context.tenantId ?? "").eq("status", "ACTIVE").order("name"),
    context.tenantId
      ? context.supabase.from("tenants").select("timezone").eq("id", context.tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  return (
    <LocationReviewView
      branches={(branchesResult.data ?? []) as LocationReviewBranch[]}
      failed={Boolean(reviewResult.error)}
      filters={filters}
      hasFilters={hasFilters}
      rows={(reviewResult.data ?? []) as LocationReviewRow[]}
      timeZone={tenantResult.data?.timezone ?? "America/Mazatlan"}
    />
  );
}
