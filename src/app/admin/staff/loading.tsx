export default function StaffLoading() {
  return <main aria-busy="true" aria-label="Cargando personal" className="enterprise-page staff-control-page">
    <header className="enterprise-page-header staff-compact-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1>Personal</h1><p>Cargando personas y asignaciones…</p></div><span className="enterprise-loading-label" role="status"><span aria-hidden="true" className="enterprise-spinner" />Cargando…</span></header>
    <div className="staff-branch-nav" aria-hidden="true"><span className="enterprise-skeleton is-heading" /><span className="enterprise-skeleton is-heading" /></div>
    <section className="enterprise-data-panel staff-inventory-panel" aria-hidden="true"><div className="enterprise-panel-header staff-inventory-heading"><span className="enterprise-skeleton is-heading" /></div><div className="branch-loading-table"><span className="enterprise-skeleton" /><span className="enterprise-skeleton" /><span className="enterprise-skeleton" /></div></section>
  </main>;
}
