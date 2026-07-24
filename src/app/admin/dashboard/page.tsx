import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";

type DashboardProps = { searchParams: Promise<{ branchId?: string; from?: string; to?: string }> };

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const { data: branches } = await context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name");
  const { data } = await context.supabase.rpc("get_dashboard_metrics", {
    target_branch_id: params.branchId || null,
    from_date: params.from ? `${params.from}T00:00:00Z` : null,
    to_date: params.to ? `${params.to}T00:00:00Z` : null
  });
  const { data: rawBranchMetrics } = await context.supabase.rpc("get_dashboard_branch_metrics", {
    from_date: params.from ? `${params.from}T00:00:00Z` : null,
    to_date: params.to ? `${params.to}T00:00:00Z` : null
  });
  const branchMetrics = (rawBranchMetrics ?? []) as Array<{ branch_id: string; branch_name: string; customer_count: number; purchase_count: number; purchase_amount_minor: number; stamps_awarded: number }>;
  const metrics = Array.isArray(data) ? data[0] : null;
  return (
    <main className="shell">
      <section className="panel" aria-labelledby="dashboard-title">
        <Link className="text-link" href="/admin">Volver</Link>
        <p className="eyebrow">Dashboard</p>
        <h1 id="dashboard-title" className="form-title">Métricas operativas</h1>
        <form className="auth-form" method="get">
          <label className="field"><span>Sucursal</span><select name="branchId" defaultValue={params.branchId ?? ""}><option value="">Todas las permitidas</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <div className="form-grid"><label className="field"><span>Desde</span><input name="from" type="date" defaultValue={params.from ?? ""} /></label><label className="field"><span>Hasta</span><input name="to" type="date" defaultValue={params.to ?? ""} /></label></div>
          <button className="primary-button" type="submit">Actualizar métricas</button>
        </form>
        <div className="route-grid" aria-label="Métricas">
          <div className="route-link"><strong>Clientes</strong><span>{metrics?.customer_count ?? 0}</span></div>
          <div className="route-link"><strong>Compras</strong><span>{metrics?.purchase_count ?? 0}</span></div>
          <div className="route-link"><strong>Monto (centavos)</strong><span>{metrics?.purchase_amount_minor ?? 0}</span></div>
          <div className="route-link"><strong>Sellos</strong><span>{metrics?.stamps_awarded ?? 0}</span></div>
          <div className="route-link"><strong>Recompensas generadas</strong><span>{metrics?.rewards_generated ?? 0}</span></div>
          <div className="route-link"><strong>Recompensas canjeadas</strong><span>{metrics?.rewards_redeemed ?? 0}</span></div>
        </div>
        <h2 className="section-title">Comparación por sucursal</h2>
        <div className="data-list">
          {branchMetrics?.map((branch) => (
            <div key={branch.branch_id}>
              <strong>{branch.branch_name}</strong>
              <span>Clientes: {branch.customer_count} · Compras: {branch.purchase_count}</span>
              <span>Monto: {branch.purchase_amount_minor} centavos · Sellos: {branch.stamps_awarded}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
