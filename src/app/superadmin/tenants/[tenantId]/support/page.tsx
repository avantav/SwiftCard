import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";

type SupportPageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TenantSupportPage({ params, searchParams }: SupportPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { tenantId } = await params;
  const { error } = await searchParams;
  const { data: tenant } = await context.supabase
    .from("tenants")
    .select("id,name,status")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  return <main className="enterprise-page">
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb">Tenants / Soporte</p>
        <h1>Acceder a {tenant.name}</h1>
        <p>Consulta el panel del tenant sin solicitar ni exponer credenciales.</p>
      </div>
      <Link className="enterprise-secondary-action" href="/superadmin">Cancelar</Link>
    </header>

    {tenant.status !== "ACTIVE" ? <p className="enterprise-alert is-warning" role="alert"><strong>Tenant suspendido.</strong> Reactívalo antes de iniciar una sesión de soporte.</p> : null}
    {error === "reason" ? <p className="enterprise-alert is-error" role="alert"><strong>Motivo requerido.</strong> Describe el caso en 10 a 500 caracteres.</p> : null}
    {error === "unavailable" ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo iniciar la sesión.</strong> Verifica el estado del tenant e inténtalo nuevamente.</p> : null}

    <section className="enterprise-content-card" aria-labelledby="support-access-title">
      <h2 id="support-access-title">Sesión temporal de solo lectura</h2>
      <p>Durará como máximo una hora y conservará tu identidad real de Superadmin.</p>
      <ul className="support-access-list">
        <li>El inicio, el motivo y la salida quedan en la auditoría del tenant.</li>
        <li>Las acciones que modifican datos permanecen bloqueadas.</li>
        <li>Puedes salir en cualquier momento desde el aviso persistente.</li>
      </ul>
      <form action="/support/start" method="post" className="form-grid">
        <input name="tenantId" type="hidden" value={tenant.id} />
        <label className="field form-span">
          <span>Motivo del acceso</span>
          <textarea disabled={tenant.status !== "ACTIVE"} maxLength={500} minLength={10} name="reason" placeholder="Ej. Revisar configuración reportada en el ticket SOP-1234" required rows={4} />
          <small>Incluye el ticket o una descripción concreta. No escribas contraseñas ni datos sensibles.</small>
        </label>
        <div className="action-row form-span">
          <Link className="enterprise-secondary-action" href="/superadmin">Volver</Link>
          <button className="enterprise-primary-action" disabled={tenant.status !== "ACTIVE"} type="submit">Iniciar modo soporte</button>
        </div>
      </form>
    </section>
  </main>;
}
