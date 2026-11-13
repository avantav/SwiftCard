import type { Metadata } from "next";
import { InsightsView } from "@/components/insights-view";
import { dayInTimeZone, parseInsightsFilters, type CustomerInsights } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";
import { supportReadParams } from "@/lib/auth/support-read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estadísticas de clientes · morrow"
};

type DashboardProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const tenantResult = context.tenantId
    ? await context.supabase.from("tenants").select("timezone,currency_code").eq("id", context.tenantId).maybeSingle()
    : { data: null, error: null };
  const timeZone = tenantResult.data?.timezone ?? "America/Mazatlan";
  const filters = parseInsightsFilters(params, dayInTimeZone(new Date(), timeZone));

  const [branchesResult, insightsResult] = await Promise.all([
    context.supabase.from("branches").select("id,name").eq("tenant_id", context.tenantId ?? "").eq("status", "ACTIVE").order("name"),
    context.supabase.schema("app").rpc("get_customer_insights", {
      target_from: filters.from,
      target_to: filters.to,
      target_branch_id: filters.branchId,
      ...supportReadParams(context)
    })
  ]);

  return (
    <main className="enterprise-page">
      <InsightsView
        branches={branchesResult.data ?? []}
        currency={tenantResult.data?.currency_code ?? "MXN"}
        failed={Boolean(insightsResult.error)}
        filters={filters}
        insights={(insightsResult.data as CustomerInsights | null) ?? null}
      />
    </main>
  );
}
