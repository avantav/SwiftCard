/**
 * Route-level loading state for admin workspaces (DESIGN_SYSTEM §15): keeps
 * the header and the panel structure while the data loads.
 */
export function WorkspaceSkeleton({ breadcrumb, title, description, rows = 6 }: { breadcrumb: string; title: string; description: string; rows?: number }) {
  return <main aria-busy="true" aria-label={`Cargando ${title.toLowerCase()}`} className="enterprise-page admin-workspace">
    <header className="enterprise-page-header admin-workspace-header">
      <div>
        <p className="enterprise-breadcrumb">{breadcrumb}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
    <div className="admin-workspace-body">
      <section className="enterprise-data-panel" aria-hidden="true">
        <div className="enterprise-panel-header"><div><span className="enterprise-skeleton is-heading" /></div></div>
        <div className="workspace-skeleton-rows">
          {Array.from({ length: rows }, (_, index) => <span className="enterprise-skeleton" key={index} />)}
        </div>
      </section>
    </div>
  </main>;
}
