import { requireInternalArea } from "@/lib/auth/server";

type DashboardProps = { searchParams: Promise<{ branchId?: string; from?: string; to?: string }> };
type BranchMetric = { branch_id: string; branch_name: string; customer_count: number; purchase_count: number; purchase_amount_minor: number; stamps_awarded: number };

function amount(value: number | string | null | undefined, currency: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value ?? 0) / 100);
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const range = { from_date: params.from ? `${params.from}T00:00:00Z` : null, to_date: params.to ? `${params.to}T00:00:00Z` : null };
  const [branchesResult, metricsResult, branchMetricsResult, tenantResult] = await Promise.all([
    context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name"),
    context.supabase.schema("app").rpc("get_dashboard_metrics", { target_branch_id: params.branchId || null, ...range }),
    context.supabase.schema("app").rpc("get_dashboard_branch_metrics", range),
    context.tenantId ? context.supabase.from("tenants").select("currency_code").eq("id", context.tenantId).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  const metrics = Array.isArray(metricsResult.data) ? metricsResult.data[0] : null;
  const branchMetrics = (branchMetricsResult.data ?? []) as BranchMetric[];
  const currency = tenantResult.data?.currency_code ?? "MXN";
  const failed = Boolean(branchesResult.error || metricsResult.error || branchMetricsResult.error || tenantResult.error);

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Operación</p><h1 id="dashboard-title">Dashboard operativo</h1><p>Consulta resultados del tenant y compara el desempeño por sucursal.</p></div></header>
    <section className="enterprise-filter-panel" aria-label="Filtros del dashboard">
      <form className="enterprise-filter-form" method="get">
        <label className="field"><span>Sucursal</span><select name="branchId" defaultValue={params.branchId ?? ""}><option value="">Todas las permitidas</option>{branchesResult.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="field"><span>Desde</span><input name="from" type="date" defaultValue={params.from ?? ""} /></label>
        <label className="field"><span>Hasta</span><input name="to" type="date" defaultValue={params.to ?? ""} /></label>
        <button className="primary-button" type="submit">Aplicar filtros</button>
      </form>
    </section>
    {failed ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudieron cargar las métricas.</strong> Intenta actualizar la página.</p> : null}
    <section aria-label="Métricas principales" className="enterprise-metrics admin-dashboard-metrics">
      <article className="enterprise-metric"><span>Clientes</span><strong>{failed ? "—" : metrics?.customer_count ?? 0}</strong><small>En el alcance seleccionado</small></article>
      <article className="enterprise-metric"><span>Compras</span><strong>{failed ? "—" : metrics?.purchase_count ?? 0}</strong><small>Operaciones confirmadas</small></article>
      <article className="enterprise-metric"><span>Monto</span><strong className="enterprise-metric-text">{failed ? "—" : amount(metrics?.purchase_amount_minor, currency)}</strong><small>Total procesado</small></article>
      <article className="enterprise-metric"><span>Sellos</span><strong>{failed ? "—" : metrics?.stamps_awarded ?? 0}</strong><small>Sellos otorgados</small></article>
      <article className="enterprise-metric"><span>Generadas</span><strong>{failed ? "—" : metrics?.rewards_generated ?? 0}</strong><small>Recompensas creadas</small></article>
      <article className="enterprise-metric"><span>Canjeadas</span><strong>{failed ? "—" : metrics?.rewards_redeemed ?? 0}</strong><small>Recompensas utilizadas</small></article>
    </section>
    <section className="enterprise-data-panel" aria-labelledby="branch-comparison-title">
      <div className="enterprise-panel-header"><div><h2 id="branch-comparison-title">Comparación por sucursal</h2><p>{branchMetrics.length} {branchMetrics.length === 1 ? "resultado" : "resultados"}</p></div></div>
      {failed ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><h3>Comparación no disponible</h3><p>Actualiza la página para volver a intentarlo.</p></div> : branchMetrics.length ? <div className="enterprise-table-wrap"><table className="enterprise-table"><caption className="sr-only">Métricas operativas por sucursal</caption><thead><tr><th scope="col">Sucursal</th><th scope="col">Clientes</th><th scope="col">Compras</th><th scope="col">Monto</th><th scope="col">Sellos</th></tr></thead><tbody>{branchMetrics.map((branch) => <tr key={branch.branch_id}><td data-label="Sucursal"><strong>{branch.branch_name}</strong></td><td data-label="Clientes" className="enterprise-number">{branch.customer_count}</td><td data-label="Compras" className="enterprise-number">{branch.purchase_count}</td><td data-label="Monto" className="enterprise-number">{amount(branch.purchase_amount_minor, currency)}</td><td data-label="Sellos" className="enterprise-number">{branch.stamps_awarded}</td></tr>)}</tbody></table></div> : <div className="enterprise-empty-state admin-compact-empty"><h3>Sin actividad para comparar</h3><p>Ajusta el rango de fechas o registra operaciones en una sucursal.</p></div>}
    </section>
  </main>;
}
