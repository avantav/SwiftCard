import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { setTenantStatus } from "./tenants/actions";

type SuperadminPageProps = {
  searchParams: Promise<{
    tenantCreated?: string;
    tenantStatus?: string;
    error?: string;
  }>;
};

export default async function SuperadminPage({
  searchParams
}: SuperadminPageProps) {
  const { tenantCreated, tenantStatus, error } = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const { data: tenants } = await context.supabase.from("tenants").select("id,name,status,branding_mode,created_at").order("created_at", { ascending: false });

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Superadmin</p>
        <h1 className="title">Tenants y operación global.</h1>
        {tenantCreated ? (
          <p className="success-alert" role="status">
            Tenant creado.
          </p>
        ) : null}
        {tenantStatus ? <p className="success-alert" role="status">Tenant actualizado a {tenantStatus}.</p> : null}
        {error ? <p className="error-alert" role="alert">{error}</p> : null}
        <p className="body-copy">
          Ruta reservada para crear tenants, suspenderlos, importar clientes y
          revisar auditoría global.
        </p>
        <div className="action-row">
          <Link className="primary-link" href="/superadmin/tenants/new">
            Nuevo tenant
          </Link>
          <Link className="secondary-link" href="/superadmin/imports">
            Importar clientes
          </Link>
        </div>
      </section>
      <section className="panel" aria-labelledby="tenants-title">
        <h2 id="tenants-title" className="section-title">Tenants</h2>
        <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Estado</th><th>Branding</th><th>Acciones</th></tr></thead><tbody>{tenants?.map((tenant) => <tr key={tenant.id}><td>{tenant.name}</td><td>{tenant.status}</td><td>{tenant.branding_mode}</td><td><Link className="text-link" href={`/superadmin/tenants/${tenant.id}/branding`}>Branding</Link> <form action={setTenantStatus}><input type="hidden" name="tenantId" value={tenant.id} /><input type="hidden" name="status" value={tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} /><button className="secondary-button" type="submit">{tenant.status === "ACTIVE" ? "Suspender" : "Reactivar"}</button></form></td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
