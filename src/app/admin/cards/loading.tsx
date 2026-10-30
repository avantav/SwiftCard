export default function CardsLoading() {
  return <main aria-busy="true" aria-label="Cargando tarjetas" className="enterprise-page cards-control-page">
    <header className="enterprise-page-header cards-compact-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1>Tarjetas</h1><p>Cargando experiencias de fidelidad…</p></div><span className="enterprise-loading-label" role="status"><span aria-hidden="true" className="enterprise-spinner" />Cargando…</span></header>
    <nav aria-hidden="true" className="cards-view-nav"><span className="enterprise-skeleton is-heading" /><span className="enterprise-skeleton is-heading" /></nav>
    <section aria-hidden="true" className="enterprise-data-panel cards-inventory-panel"><div className="enterprise-panel-header cards-inventory-heading"><span className="enterprise-skeleton is-heading" /></div><div className="branch-loading-table"><span className="enterprise-skeleton" /><span className="enterprise-skeleton" /><span className="enterprise-skeleton" /></div></section>
  </main>;
}
