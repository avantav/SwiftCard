import Link from "next/link";
import { AdminScrollRegion, AdminWorkspace } from "@/components/admin/admin-workspace";
import type { SetupChecklist } from "@/lib/admin/onboarding";
import { loadSetupChecklist } from "@/lib/admin/onboarding-server";
import { requireInternalArea } from "@/lib/auth/server";

const adminLinks = [
  { href: "/admin/branches", title: "Sucursales", description: "Ubicaciones, GPS y registro público." },
  { href: "/admin/staff", title: "Personal", description: "Cuentas, roles y asignaciones." },
  { href: "/admin/cards", title: "Tarjetas", description: "Programa, diseño y publicación." },
  { href: "/admin/customers", title: "Clientes", description: "Búsqueda, estado y tarjetas emitidas." },
];

function SetupGuide({ checklist }: { checklist: SetupChecklist }) {
  return <section className="enterprise-data-panel admin-setup-guide" aria-labelledby="setup-title">
    <div className="enterprise-panel-header">
      <div><h2 id="setup-title">Configura tu programa</h2><p>{checklist.completed} de {checklist.total} pasos listos. Sigue el orden para empezar a registrar clientes.</p></div>
      <progress aria-label={`${checklist.completed} de ${checklist.total} pasos listos`} className="admin-setup-progress" max={checklist.total} value={checklist.completed} />
    </div>
    <ol className="admin-setup-steps">
      {checklist.steps.map((step, index) => <li className={step.done ? "is-done" : step.id === checklist.next?.id ? "is-next" : undefined} key={step.id}>
        <span className="admin-setup-marker" aria-hidden="true">{step.done ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg> : index + 1}</span>
        <span className="admin-setup-copy"><strong>{step.label}</strong><small>{step.description}</small></span>
        <span className="admin-setup-state">{step.done ? <span className="enterprise-badge is-active">Listo</span> : step.id === checklist.next?.id ? null : <Link className="enterprise-secondary-action" href={step.href}>{step.cta}</Link>}</span>
      </li>)}
    </ol>
  </section>;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ supportError?: string }> }) {
  const { supportError } = await searchParams;
  const context = await requireInternalArea("ADMIN");
  const isAdmin = context.access.role === "ADMIN";
  const [{ data: tenant, error: tenantError }, checklist] = await Promise.all([
    context.tenantId ? context.supabase.from("tenants").select("name,status,currency_code").eq("id", context.tenantId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    isAdmin && context.tenantId && !context.supportSession ? loadSetupChecklist(context.supabase, context.tenantId) : Promise.resolve(null),
  ]);
  const links = isAdmin ? adminLinks : [];
  const next = checklist?.next ?? null;

  return <AdminWorkspace
    breadcrumb="Vista general"
    description="Supervisa el programa, la operación y los datos del negocio."
    primaryAction={next
      ? <Link className="enterprise-primary-action" href={next.href}>Siguiente paso: {next.cta}</Link>
      : <Link className="enterprise-primary-action" href="/admin/dashboard">Ver estadísticas</Link>}
    title={tenant?.name ?? "Administración"}
    toolbar={tenantError || supportError === "read_only" ? <>
      {tenantError ? <p className="enterprise-alert is-error" role="alert">No se pudo cargar la información del negocio. Actualiza la página.</p> : null}
      {supportError === "read_only" ? <p className="enterprise-alert is-warning" role="alert"><strong>Acción bloqueada.</strong> El modo soporte permite consultar información, pero no modificarla.</p> : null}
    </> : undefined}
  >
    <AdminScrollRegion className="is-plain" label="Vista general">
      {checklist && next ? <SetupGuide checklist={checklist} /> : null}
      <section aria-label="Contexto de la cuenta" className="enterprise-metrics admin-overview-metrics">
        <article className="enterprise-metric"><span>Estado del negocio</span><strong className="enterprise-metric-text">{tenant?.status === "ACTIVE" ? "Activo" : "No disponible"}</strong><small>Acceso operativo actual</small></article>
        <article className="enterprise-metric"><span>Tu rol</span><strong className="enterprise-metric-text">{isAdmin ? "Admin general" : "Administrador de sucursal"}</strong><small>Permisos aplicados por sesión</small></article>
        <article className="enterprise-metric"><span>Moneda</span><strong>{tenant?.currency_code ?? "—"}</strong><small>Unidad configurada del negocio</small></article>
      </section>
      <section className="enterprise-data-panel" aria-labelledby="admin-actions-title">
        <div className="enterprise-panel-header"><div><h2 id="admin-actions-title">Centro de administración</h2><p>Accesos disponibles para tu rol.</p></div></div>
        <div className="admin-action-list">
          {links.map((item) => <Link href={item.href} key={item.href}><span><strong>{item.title}</strong><small>{item.description}</small></span><span aria-hidden="true">→</span></Link>)}
          <Link href="/admin/dashboard"><span><strong>Estadísticas</strong><small>Clientes, visitas y premios por periodo y sucursal.</small></span><span aria-hidden="true">→</span></Link>
          <Link href="/admin/exports"><span><strong>Exportaciones</strong><small>Descarga información autorizada en CSV o XLSX.</small></span><span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </AdminScrollRegion>
  </AdminWorkspace>;
}
