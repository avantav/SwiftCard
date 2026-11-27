import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { formatServiceOrderPrice, SERVICE_ORDER_COLUMNS, type ServiceOrder } from "@/lib/billing/service-orders";
import { createServiceOrder } from "./actions";

type ServiceOrderPageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function ServiceOrderPage({ params, searchParams }: ServiceOrderPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { tenantId } = await params;
  const query = await searchParams;
  const [{ data: tenant }, { data: orderRows, error: ordersError }] = await Promise.all([
    context.supabase.from("tenants").select("id,name").eq("id", tenantId).maybeSingle(),
    context.supabase.from("tenant_service_orders").select(SERVICE_ORDER_COLUMNS)
      .eq("tenant_id", tenantId).order("version", { ascending: false }),
  ]);
  if (!tenant) notFound();
  const orders = (orderRows ?? []) as ServiceOrder[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Tenants · Orden de Servicio</p>
          <h1 id="service-order-title">{tenant.name}</h1>
          <p>Condiciones comerciales propias de este negocio. El administrador general las acepta en Plan y uso.</p>
        </div>
        <Link className="enterprise-secondary-action" href="/superadmin">Volver a tenants</Link>
      </header>

      <section className="enterprise-content-card" aria-labelledby="new-order-title">
        <div>
          <h2 id="new-order-title">Nueva versión</h2>
          <p>Cada versión es definitiva. Para cambiar el precio o el alcance, crea una nueva; la anterior deja de poder aceptarse.</p>
        </div>
        {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
        {query.saved ? <p className="enterprise-alert is-success" role="status">Orden de Servicio creada. Queda pendiente de aceptación.</p> : null}
        <form className="auth-form" action={createServiceOrder}>
          <input type="hidden" name="tenantId" value={tenant.id} />
          <label className="field"><span>Plan</span><input name="planName" maxLength={80} minLength={2} required placeholder="Empresarial" /></label>
          <div className="form-grid">
            <label className="field"><span>Precio sin IVA (MXN)</span><input name="price" inputMode="decimal" required placeholder="1500.00" /></label>
            <label className="field">
              <span>Periodicidad</span>
              <select name="billingInterval" defaultValue="MONTH">
                <option value="MONTH">Mensual</option>
                <option value="YEAR">Anual</option>
                <option value="ONE_TIME">Pago único</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="currencyCode" value="MXN" />
          <label className="field"><span>Incluye</span><textarea name="includedScope" rows={4} minLength={10} maxLength={4000} required placeholder="Sucursales, tarjetas, membresías, campañas, soporte…" /></label>
          <label className="field"><span>No incluye</span><textarea name="excludedScope" rows={4} minLength={10} maxLength={4000} required defaultValue="Personalizaciones, integraciones, diseño, migraciones de datos y cualquier trabajo adicional, que se cotizan por separado." /></label>
          <div className="form-grid">
            <label className="field"><span>Vigente desde</span><input name="startsOn" type="date" required defaultValue={today} /></label>
            <label className="field"><span>Vigente hasta <small>(opcional)</small></span><input name="endsOn" type="date" /></label>
          </div>
          <SubmitButton confirmMessage="¿Crear esta Orden de Servicio? No se podrá editar después.">Crear Orden de Servicio</SubmitButton>
        </form>
      </section>

      <section className="enterprise-data-panel" aria-labelledby="orders-title">
        <div className="enterprise-panel-header"><div><h2 id="orders-title">Versiones</h2><p>{orders.length} {orders.length === 1 ? "versión" : "versiones"}</p></div></div>
        {ordersError ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar las órdenes.</p> : orders.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Órdenes de Servicio del tenant</caption>
              <thead><tr><th scope="col">Versión</th><th scope="col">Plan</th><th scope="col">Precio</th><th scope="col">Vigencia</th><th scope="col">Aceptación</th></tr></thead>
              <tbody>{orders.map((order, index) => (
                <tr key={order.id}>
                  <td className="enterprise-number" data-label="Versión">{order.version}</td>
                  <td data-label="Plan"><strong>{order.plan_name}</strong></td>
                  <td data-label="Precio">{formatServiceOrderPrice(order)}</td>
                  <td data-label="Vigencia">{date(order.starts_on)}{order.ends_on ? ` – ${date(order.ends_on)}` : " · sin fecha de fin"}</td>
                  <td data-label="Aceptación">{order.accepted_at
                    ? <span className="enterprise-badge is-active">Aceptada {date(order.accepted_at)}</span>
                    : <span className={`enterprise-badge ${index === 0 ? "is-suspended" : "is-neutral"}`}>{index === 0 ? "Pendiente" : "Sustituida"}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="enterprise-empty-state"><h3>Sin Órdenes de Servicio</h3><p>Este negocio usa el precio publicado de su plan.</p></div>}
      </section>
    </main>
  );
}
