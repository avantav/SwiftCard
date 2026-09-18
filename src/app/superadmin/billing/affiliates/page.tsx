import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { formatMinorUnitsForInput } from "@/lib/admin/program";
import { createBillingAffiliate, setBillingAffiliateStatus } from "./actions";

type PageProps = { searchParams: Promise<{ created?: string; status?: string; error?: string }> };
type BillingAffiliate = {
  id: string;
  code: string;
  display_name: string;
  contact_email: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  commission_type: "PERCENT" | "FIXED_AMOUNT";
  commission_basis_points: number | null;
  commission_amount_minor: number | null;
  currency_code: string | null;
  attribution_window_days: number;
};

function commissionLabel(item: BillingAffiliate) {
  if (item.commission_type === "PERCENT") return `${(item.commission_basis_points ?? 0) / 100}%`;
  return `${item.currency_code} $${formatMinorUnitsForInput(item.commission_amount_minor ?? 0, item.currency_code ?? "MXN")}`;
}

export default async function BillingAffiliatesPage({ searchParams }: PageProps) {
  const messages = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const response = await context.supabase.from("billing_affiliates")
    .select("id,code,display_name,contact_email,status,commission_type,commission_basis_points,commission_amount_minor,currency_code,attribution_window_days")
    .order("created_at", { ascending: false });
  const affiliates = (response.data ?? []) as BillingAffiliate[];

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Comercial / Afiliados</p><h1>Afiliados</h1><p>Administra códigos, atribución y reglas de comisión.</p></div></header>

    {messages.created ? <p className="enterprise-alert is-success" role="status"><strong>Afiliado creado.</strong> Está en borrador hasta que lo actives.</p> : null}
    {messages.status ? <p className="enterprise-alert is-success" role="status"><strong>Estado actualizado.</strong> El afiliado quedó {messages.status === "ACTIVE" ? "activo" : "archivado"}.</p> : null}
    {messages.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {messages.error}</p> : null}

    <section className="enterprise-content-card" aria-labelledby="create-affiliate-title">
      <h2 id="create-affiliate-title">Crear afiliado</h2>
      <p>La atribución queda asociada al tenant; los pagos de comisión siguen siendo manuales.</p>
      <form action={createBillingAffiliate} className="form-grid">
        <label className="field"><span>Código</span><input name="code" required minLength={3} maxLength={50} placeholder="SOCIO10" /></label>
        <label className="field"><span>Nombre</span><input name="displayName" required minLength={2} maxLength={120} /></label>
        <label className="field"><span>Correo de contacto (opcional)</span><input name="contactEmail" type="email" maxLength={254} /></label>
        <label className="field"><span>Tipo de comisión</span><select name="commissionType" defaultValue="PERCENT"><option value="PERCENT">Porcentaje</option><option value="FIXED_AMOUNT">Monto fijo</option></select></label>
        <label className="field"><span>Valor de comisión</span><input name="commissionValue" inputMode="decimal" required placeholder="10" /></label>
        <label className="field"><span>Moneda para monto fijo</span><input name="currencyCode" defaultValue="MXN" minLength={3} maxLength={3} /></label>
        <label className="field"><span>Ventana de atribución (días)</span><input name="attributionWindowDays" type="number" min="1" max="365" defaultValue="30" required /></label>
        <SubmitButton className="primary-button form-submit">Crear afiliado en borrador</SubmitButton>
      </form>
    </section>

    <section className="enterprise-data-panel" aria-labelledby="affiliate-directory-title">
      <div className="enterprise-panel-header"><div><h2 id="affiliate-directory-title">Directorio</h2><p>{response.error ? "No disponible" : `${affiliates.length} ${affiliates.length === 1 ? "afiliado" : "afiliados"}`}</p></div></div>
      {response.error ? <div className="enterprise-empty-state is-error" role="alert"><h3>No se pudo cargar el directorio</h3><p>Verifica que las migraciones 0059 y 0061 estén aplicadas.</p></div> : affiliates.length === 0 ? <div className="enterprise-empty-state"><h3>Aún no hay afiliados</h3><p>Crea el primero con el formulario anterior.</p></div> : <div className="enterprise-table-wrap"><table className="enterprise-table billing-affiliate-table"><caption className="sr-only">Directorio comercial de afiliados</caption><thead><tr><th scope="col">Afiliado</th><th scope="col">Contacto</th><th scope="col">Comisión</th><th scope="col">Atribución</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead><tbody>{affiliates.map((item) => <tr key={item.id}><td data-label="Afiliado"><strong>{item.display_name}</strong><br /><small>{item.code}</small></td><td data-label="Contacto">{item.contact_email ?? "Sin correo"}</td><td data-label="Comisión">{commissionLabel(item)}</td><td data-label="Atribución">{item.attribution_window_days} días</td><td data-label="Estado"><span className={`enterprise-badge ${item.status === "ACTIVE" ? "is-active" : item.status === "ARCHIVED" ? "is-suspended" : "is-neutral"}`}>{item.status === "ACTIVE" ? "Activo" : item.status === "ARCHIVED" ? "Archivado" : "Borrador"}</span></td><td><form action={setBillingAffiliateStatus}><input type="hidden" name="affiliateId" value={item.id} /><input type="hidden" name="status" value={item.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} /><SubmitButton className="enterprise-secondary-action" confirmMessage={item.status === "ACTIVE" ? `Archivar ${item.display_name}? Sus atribuciones y comisiones históricas se conservarán.` : undefined}>{item.status === "ACTIVE" ? "Archivar" : "Activar"}</SubmitButton></form></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
