import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { TenantStatusForm } from "@/components/tenant-status-form";

type SuperadminPageProps = {
  searchParams: Promise<{
    tenantCreated?: string;
    tenantStatus?: string;
    error?: string;
  }>;
};

type Tenant = {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  branding_mode: "STANDARD" | "WHITE_LABEL";
  created_at: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export default async function SuperadminPage({ searchParams }: SuperadminPageProps) {
  const { tenantCreated, tenantStatus, error } = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const [tenantResponse, administratorResponse] = await Promise.all([
    context.supabase
      .from("tenants")
      .select("id,name,status,branding_mode,created_at")
      .order("created_at", { ascending: false }),
    context.supabase
      .from("staff_profiles")
      .select("tenant_id")
      .eq("role", "ADMIN")
  ]);
  const tenants = (tenantResponse.data ?? []) as Tenant[];
  const administrators = administratorResponse.data ?? [];
  const failed = Boolean(tenantResponse.error || administratorResponse.error);
  const activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const suspendedTenants = tenants.filter((tenant) => tenant.status === "SUSPENDED").length;
  const adminCountByTenant = new Map<string, number>();

  for (const administrator of administrators) {
    if (administrator.tenant_id) {
      adminCountByTenant.set(
        administrator.tenant_id,
        (adminCountByTenant.get(administrator.tenant_id) ?? 0) + 1
      );
    }
  }

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Vista general</p>
          <h1>Tenants</h1>
          <p>Administra acceso, estado y configuración de cada negocio.</p>
        </div>
        <Link className="enterprise-primary-action" href="/superadmin/tenants/new">
          <span aria-hidden="true">+</span>
          Crear tenant
        </Link>
      </header>

      {tenantCreated ? <p className="enterprise-alert is-success" role="status"><strong>Tenant creado.</strong> Ahora configura su Administrador y operación inicial.</p> : null}
      {tenantStatus ? <p className="enterprise-alert is-success" role="status"><strong>Estado actualizado.</strong> El tenant ahora está {tenantStatus === "ACTIVE" ? "activo" : "suspendido"}.</p> : null}
      {error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {error}</p> : null}

      <section aria-label="Resumen de tenants" className="enterprise-metrics">
        <article className="enterprise-metric">
          <span>Total de tenants</span>
          <strong>{failed ? "—" : tenants.length}</strong>
          <small>Negocios registrados</small>
        </article>
        <article className="enterprise-metric">
          <span>Activos</span>
          <strong>{failed ? "—" : activeTenants}</strong>
          <small>Con operación habilitada</small>
        </article>
        <article className="enterprise-metric">
          <span>Suspendidos</span>
          <strong>{failed ? "—" : suspendedTenants}</strong>
          <small>Sin acceso operativo</small>
        </article>
        <article className="enterprise-metric">
          <span>Administradores</span>
          <strong>{failed ? "—" : administrators.length}</strong>
          <small>Cuentas tenant creadas</small>
        </article>
      </section>

      <section aria-labelledby="tenant-directory-title" className="enterprise-data-panel">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="tenant-directory-title">Directorio de tenants</h2>
            <p>{failed ? "La información no está disponible." : `${tenants.length} ${tenants.length === 1 ? "resultado" : "resultados"}`}</p>
          </div>
          <Link className="enterprise-secondary-action" href="/superadmin/imports">Importar clientes</Link>
        </div>

        {failed ? (
          <div className="enterprise-empty-state is-error" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudieron cargar los tenants</h3>
            <p>Actualiza la página. Si el problema continúa, revisa la conexión con Supabase.</p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="enterprise-empty-state">
            <span className="enterprise-empty-icon" aria-hidden="true">+</span>
            <h3>Crea tu primer tenant</h3>
            <p>Agrega un negocio para configurar su Administrador, sucursales y programa de fidelidad.</p>
            <Link className="enterprise-primary-action" href="/superadmin/tenants/new">Crear tenant</Link>
          </div>
        ) : (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Tenants disponibles para administración global</caption>
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Branding</th>
                  <th scope="col">Administradores</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td data-label="Tenant">
                      <div className="enterprise-tenant-cell">
                        <span aria-hidden="true">{initials(tenant.name)}</span>
                        <div><strong>{tenant.name}</strong><small>Creado {formattedDate(tenant.created_at)}</small></div>
                      </div>
                    </td>
                    <td data-label="Estado"><span className={`enterprise-badge ${tenant.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{tenant.status === "ACTIVE" ? "Activo" : "Suspendido"}</span></td>
                    <td data-label="Branding"><span className="enterprise-badge is-neutral">{tenant.branding_mode === "WHITE_LABEL" ? "White-label" : "Estándar"}</span></td>
                    <td data-label="Administradores" className="enterprise-number">{adminCountByTenant.get(tenant.id) ?? 0}</td>
                    <td className="enterprise-row-actions">
                      <details>
                        <summary>Administrar</summary>
                        <div className="enterprise-row-menu">
                          <Link href={`/superadmin/tenants/${tenant.id}/administrator/new`}>Administrador</Link>
                          <Link href={`/superadmin/tenants/${tenant.id}/branding`}>Branding</Link>
                          <TenantStatusForm tenantId={tenant.id} status={tenant.status} tenantName={tenant.name} />
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
