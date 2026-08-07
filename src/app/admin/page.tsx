import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";

const adminLinks = [
  { href: "/admin/branches", title: "Sucursales", description: "Ubicaciones, geofence y proximidad." },
  { href: "/admin/staff", title: "Personal", description: "Cuentas, roles y asignaciones." },
  { href: "/admin/program", title: "Programa de fidelidad", description: "Reglas, sellos y recompensa principal." }
];

export default async function AdminPage() {
  const context = await requireInternalArea("ADMIN");
  const { data: tenant, error: tenantError } = context.tenantId ? await context.supabase.from("tenants").select("name,status,currency_code").eq("id", context.tenantId).maybeSingle() : { data: null, error: null };
  const links = context.access.role === "ADMIN" ? adminLinks : [];

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Vista general</p><h1>{tenant?.name ?? "Administración"}</h1><p>Supervisa el programa, la operación y los datos del tenant.</p></div><Link className="enterprise-primary-action" href="/admin/dashboard">Ver dashboard</Link></header>
    {tenantError ? <p className="enterprise-alert is-error" role="alert">No se pudo cargar la información del tenant. Actualiza la página.</p> : null}
    <section aria-label="Contexto de la cuenta" className="enterprise-metrics admin-overview-metrics">
      <article className="enterprise-metric"><span>Estado del tenant</span><strong className="enterprise-metric-text">{tenant?.status === "ACTIVE" ? "Activo" : "No disponible"}</strong><small>Acceso operativo actual</small></article>
      <article className="enterprise-metric"><span>Tu rol</span><strong className="enterprise-metric-text">{context.access.role === "ADMIN" ? "Admin general" : "Administrador de sucursal"}</strong><small>Permisos aplicados por sesión</small></article>
      <article className="enterprise-metric"><span>Moneda</span><strong>{tenant?.currency_code ?? "—"}</strong><small>Unidad configurada del tenant</small></article>
    </section>
    <section className="enterprise-data-panel" aria-labelledby="admin-actions-title">
      <div className="enterprise-panel-header"><div><h2 id="admin-actions-title">Centro de administración</h2><p>Accesos disponibles para tu rol.</p></div><Link className="enterprise-secondary-action" href="/admin/exports">Exportar datos</Link></div>
      <div className="admin-action-list">
        {links.map((item) => <Link href={item.href} key={item.href}><span><strong>{item.title}</strong><small>{item.description}</small></span><span aria-hidden="true">→</span></Link>)}
        <Link href="/admin/dashboard"><span><strong>Dashboard operativo</strong><small>Métricas, filtros y comparación por sucursal.</small></span><span aria-hidden="true">→</span></Link>
        <Link href="/admin/exports"><span><strong>Exportaciones</strong><small>Descarga información autorizada en CSV o XLSX.</small></span><span aria-hidden="true">→</span></Link>
      </div>
    </section>
  </main>;
}
