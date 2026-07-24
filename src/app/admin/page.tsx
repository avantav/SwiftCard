import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Administrador</p>
        <h1 className="title">Configuración del tenant.</h1>
        <p className="body-copy">
          Ruta reservada para sucursales, empleados, programa, branding,
          clientes, estadísticas, exportaciones y auditoría del tenant.
        </p>
        <div className="action-row">
          <Link className="primary-link" href="/admin/branches">
            Sucursales
          </Link>
          <Link className="primary-link" href="/admin/staff">
            Personal
          </Link>
          <Link className="primary-link" href="/admin/dashboard">
            Dashboard
          </Link>
          <Link className="primary-link" href="/admin/exports">
            Exportaciones
          </Link>
        </div>
      </section>
    </main>
  );
}
