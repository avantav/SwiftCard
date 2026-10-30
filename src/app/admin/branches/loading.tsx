export default function BranchesLoading() {
  return (
    <main aria-busy="true" aria-label="Cargando sucursales" className="enterprise-page branches-control-page branch-loading-page">
      <header className="enterprise-page-header branch-compact-header">
        <div>
          <p className="enterprise-eyebrow">Configuración</p>
          <h1>Sucursales</h1>
          <p>Cargando la configuración de tus ubicaciones…</p>
        </div>
        <span className="enterprise-loading-label" role="status"><span aria-hidden="true" className="enterprise-spinner" />Cargando…</span>
      </header>
      <section className="enterprise-data-panel branches-inventory-panel branch-loading-panel" aria-hidden="true">
        <div className="enterprise-panel-header"><span className="enterprise-skeleton is-heading" /></div>
        <div className="branch-loading-table">
          <span className="enterprise-skeleton" />
          <span className="enterprise-skeleton" />
          <span className="enterprise-skeleton" />
        </div>
      </section>
    </main>
  );
}
