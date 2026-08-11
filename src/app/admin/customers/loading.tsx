export default function CustomerDirectoryLoading() {
  return (
    <main className="enterprise-page" aria-busy="true" aria-label="Cargando clientes">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Datos</p>
          <h1>Clientes</h1>
          <p>Cargando el directorio del tenant…</p>
        </div>
      </header>
      <section className="enterprise-data-panel">
        <div className="enterprise-panel-header"><div><h2>Directorio de clientes</h2><p>Consultando registros…</p></div></div>
        <div className="admin-customer-loading-list" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </div>
      </section>
    </main>
  );
}
