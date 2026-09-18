import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { formatMinorUnitsForInput } from "@/lib/admin/program";
import { createBillingPromotion, setBillingPromotionStatus } from "./actions";

type PageProps = { searchParams: Promise<{ created?: string; status?: string; error?: string }> };
type CatalogStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BillingPackage = { id: string; code: string; name: string; status: CatalogStatus };
type BillingPromotion = {
  id: string; code: string; name: string; status: CatalogStatus;
  discount_type: "PERCENT" | "FIXED_AMOUNT"; percent_off_basis_points: number | null;
  amount_off_minor: number | null; currency_code: string | null; duration: "ONCE" | "REPEATING" | "FOREVER";
  duration_months: number | null; starts_at: string | null; ends_at: string | null;
  max_redemptions: number | null; max_redemptions_per_tenant: number; membership_coverage_limit: number | null;
};
type PromotionPackage = { promotion_id: string; package_id: string };

function discountLabel(item: BillingPromotion) {
  if (item.discount_type === "PERCENT") return `${(item.percent_off_basis_points ?? 0) / 100}%`;
  return `${item.currency_code} $${formatMinorUnitsForInput(item.amount_off_minor ?? 0, item.currency_code ?? "MXN")}`;
}

function durationLabel(item: BillingPromotion) {
  if (item.duration === "ONCE") return "Primer cobro";
  if (item.duration === "FOREVER") return "Permanente";
  return `${item.duration_months} meses`;
}

export default async function BillingPromotionsPage({ searchParams }: PageProps) {
  const messages = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const [promotionsResponse, packagesResponse, eligibilityResponse] = await Promise.all([
    context.supabase.from("billing_promotions").select("id,code,name,status,discount_type,percent_off_basis_points,amount_off_minor,currency_code,duration,duration_months,starts_at,ends_at,max_redemptions,max_redemptions_per_tenant,membership_coverage_limit").order("created_at", { ascending: false }),
    context.supabase.from("billing_packages").select("id,code,name,status").order("name"),
    context.supabase.from("billing_promotion_packages").select("promotion_id,package_id")
  ]);
  const promotions = (promotionsResponse.data ?? []) as BillingPromotion[];
  const packages = (packagesResponse.data ?? []) as BillingPackage[];
  const eligibility = (eligibilityResponse.data ?? []) as PromotionPackage[];
  const availablePackages = packages.filter((item) => item.status !== "ARCHIVED");
  const failed = Boolean(promotionsResponse.error || packagesResponse.error || eligibilityResponse.error);
  const packageById = new Map(packages.map((item) => [item.id, item]));
  const packageNamesByPromotion = new Map<string, string[]>();
  eligibility.forEach((item) => {
    const name = packageById.get(item.package_id)?.name;
    if (name) packageNamesByPromotion.set(item.promotion_id, [...(packageNamesByPromotion.get(item.promotion_id) ?? []), name]);
  });

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Comercial / Promociones</p><h1>Promociones</h1><p>Controla descuentos, vigencia, paquetes y topes de aplicación.</p></div></header>

    {messages.created ? <p className="enterprise-alert is-success" role="status"><strong>Promoción creada.</strong> Está en borrador hasta que la actives.</p> : null}
    {messages.status ? <p className="enterprise-alert is-success" role="status"><strong>Estado actualizado.</strong> La promoción quedó {messages.status === "ACTIVE" ? "activa" : "archivada"}.</p> : null}
    {messages.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {messages.error}</p> : null}

    <section className="enterprise-content-card" aria-labelledby="create-promotion-title">
      <h2 id="create-promotion-title">Crear promoción</h2>
      <p>Se crea en borrador. Para activarla, al menos uno de sus paquetes debe estar activo.</p>
      <form action={createBillingPromotion} className="form-grid">
        <label className="field"><span>Código</span><input name="code" required minLength={3} maxLength={50} placeholder="LANZAMIENTO20" /></label>
        <label className="field"><span>Nombre</span><input name="name" required minLength={2} maxLength={100} /></label>
        <label className="field"><span>Descripción</span><textarea name="description" maxLength={500} /></label>
        <label className="field"><span>Tipo de descuento</span><select name="discountType" defaultValue="PERCENT"><option value="PERCENT">Porcentaje</option><option value="FIXED_AMOUNT">Monto fijo</option></select></label>
        <label className="field"><span>Valor del descuento</span><input name="discountValue" inputMode="decimal" required placeholder="20" /></label>
        <label className="field"><span>Moneda para monto fijo</span><input name="currencyCode" defaultValue="MXN" minLength={3} maxLength={3} /></label>
        <label className="field"><span>Duración</span><select name="duration" defaultValue="ONCE"><option value="ONCE">Primer cobro</option><option value="REPEATING">Varios meses</option><option value="FOREVER">Permanente</option></select></label>
        <label className="field"><span>Meses si es repetitiva</span><input name="durationMonths" type="number" min="1" /></label>
        <label className="field"><span>Inicio (opcional)</span><input name="startsAt" type="date" /></label>
        <label className="field"><span>Fin exclusivo (opcional)</span><input name="endsAt" type="date" /></label>
        <label className="field"><span>Máximo global</span><input name="maxRedemptions" type="number" min="1" /></label>
        <label className="field"><span>Máximo por tenant</span><input name="maxRedemptionsPerTenant" type="number" min="1" defaultValue="1" required /></label>
        <label className="field"><span>Máximo de membresías cubiertas</span><input name="membershipCoverageLimit" type="number" min="1" /></label>
        <fieldset className="billing-entitlements form-span"><legend>Paquetes elegibles</legend>{availablePackages.length === 0 ? <p>No hay paquetes disponibles.</p> : availablePackages.map((item) => <label key={item.id}><input name="packageIds" type="checkbox" value={item.id} /> {item.name} <small>({item.status === "ACTIVE" ? "activo" : "borrador"})</small></label>)}</fieldset>
        <SubmitButton className="primary-button form-submit" disabled={availablePackages.length === 0}>Crear promoción en borrador</SubmitButton>
      </form>
    </section>

    <section className="enterprise-data-panel" aria-labelledby="promotion-directory-title">
      <div className="enterprise-panel-header"><div><h2 id="promotion-directory-title">Catálogo</h2><p>{failed ? "No disponible" : `${promotions.length} ${promotions.length === 1 ? "promoción" : "promociones"}`}</p></div></div>
      {failed ? <div className="enterprise-empty-state is-error" role="alert"><h3>No se pudo cargar el catálogo</h3><p>Verifica que las migraciones 0059 y 0060 estén aplicadas.</p></div> : promotions.length === 0 ? <div className="enterprise-empty-state"><h3>Aún no hay promociones</h3><p>Crea la primera con el formulario anterior.</p></div> : <div className="enterprise-table-wrap"><table className="enterprise-table"><caption className="sr-only">Catálogo comercial de promociones</caption><thead><tr><th scope="col">Promoción</th><th scope="col">Descuento</th><th scope="col">Paquetes</th><th scope="col">Topes</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead><tbody>{promotions.map((item) => <tr key={item.id}><td data-label="Promoción"><strong>{item.name}</strong><br /><small>{item.code} · {durationLabel(item)}</small></td><td data-label="Descuento">{discountLabel(item)}</td><td data-label="Paquetes">{packageNamesByPromotion.get(item.id)?.join(", ") || "Sin paquete disponible"}</td><td data-label="Topes">{item.max_redemptions ?? "∞"} global · {item.max_redemptions_per_tenant} por tenant<br /><small>{item.membership_coverage_limit ? `${item.membership_coverage_limit} membresías` : "Sin tope de membresías"}</small></td><td data-label="Estado"><span className={`enterprise-badge ${item.status === "ACTIVE" ? "is-active" : item.status === "ARCHIVED" ? "is-suspended" : "is-neutral"}`}>{item.status === "ACTIVE" ? "Activa" : item.status === "ARCHIVED" ? "Archivada" : "Borrador"}</span></td><td><form action={setBillingPromotionStatus}><input type="hidden" name="promotionId" value={item.id} /><input type="hidden" name="status" value={item.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} /><SubmitButton className="enterprise-secondary-action" confirmMessage={item.status === "ACTIVE" ? `Archivar ${item.name}? Sus aplicaciones históricas se conservarán.` : undefined}>{item.status === "ACTIVE" ? "Archivar" : "Activar"}</SubmitButton></form></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
