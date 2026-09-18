import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { formatMinorUnitsForInput } from "@/lib/admin/program";
import { createBillingPackage, setBillingPackageStatus } from "./actions";

type PageProps = {
  searchParams: Promise<{ created?: string; status?: string; error?: string }>;
};

type BillingPackage = {
  id: string;
  code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  membership_limit: number | null;
  branch_limit: number | null;
  loyalty_card_limit: number | null;
  version: number;
};

type BillingPrice = {
  package_id: string;
  currency_code: string;
  billing_interval: "MONTH" | "YEAR";
  amount_minor: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

function formatLimit(value: number | null) {
  return value === null ? "Sin límite" : new Intl.NumberFormat("es-MX").format(value);
}

function formatPrice(price: BillingPrice | undefined) {
  if (!price) return "Sin precio";
  const amount = formatMinorUnitsForInput(price.amount_minor, price.currency_code);
  return `${price.currency_code} $${amount} / ${price.billing_interval === "MONTH" ? "mes" : "año"}`;
}

export default async function BillingPackagesPage({ searchParams }: PageProps) {
  const messages = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const [packagesResponse, pricesResponse] = await Promise.all([
    context.supabase.from("billing_packages")
      .select("id,code,name,status,membership_limit,branch_limit,loyalty_card_limit,version")
      .order("created_at", { ascending: false }),
    context.supabase.from("billing_package_prices")
      .select("package_id,currency_code,billing_interval,amount_minor,status")
  ]);
  const packages = (packagesResponse.data ?? []) as BillingPackage[];
  const prices = (pricesResponse.data ?? []) as BillingPrice[];
  const failed = Boolean(packagesResponse.error || pricesResponse.error);
  const priceByPackage = new Map(prices.map((price) => [price.package_id, price]));

  return <main className="enterprise-page">
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb">Comercial / Paquetes</p>
        <h1>Paquetes y precios</h1>
        <p>Define ofertas comerciales sin modificar contratos históricos.</p>
      </div>
    </header>

    {messages.created ? <p className="enterprise-alert is-success" role="status"><strong>Paquete creado.</strong> Está en borrador hasta que lo actives.</p> : null}
    {messages.status ? <p className="enterprise-alert is-success" role="status"><strong>Estado actualizado.</strong> El paquete y su precio quedaron {messages.status === "ACTIVE" ? "activos" : "archivados"}.</p> : null}
    {messages.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {messages.error}</p> : null}

    <section className="enterprise-content-card" aria-labelledby="create-package-title">
      <h2 id="create-package-title">Crear paquete</h2>
      <p>Los campos vacíos de límite significan que esa dimensión no tiene tope.</p>
      <form action={createBillingPackage} className="form-grid">
        <label className="field"><span>Código interno</span><input name="code" required maxLength={50} placeholder="growth_mx" /></label>
        <label className="field"><span>Nombre</span><input name="name" required maxLength={100} /></label>
        <label className="field"><span>Descripción</span><textarea name="description" maxLength={500} /></label>
        <label className="field"><span>Límite de membresías</span><input name="membershipLimit" type="number" min="1" max="100000000" /></label>
        <label className="field"><span>Límite de sucursales</span><input name="branchLimit" type="number" min="1" max="100000" /></label>
        <label className="field"><span>Límite de tarjetas</span><input name="loyaltyCardLimit" type="number" min="1" max="3" /></label>
        <label className="field"><span>Moneda</span><input name="currencyCode" defaultValue="MXN" minLength={3} maxLength={3} required /></label>
        <label className="field"><span>Periodicidad</span><select name="billingInterval" defaultValue="MONTH"><option value="MONTH">Mensual</option><option value="YEAR">Anual</option></select></label>
        <label className="field"><span>Precio</span><input name="amount" inputMode="decimal" defaultValue="0" required /></label>
        <fieldset className="billing-entitlements form-span"><legend>Capacidades</legend><label><input name="appleWallet" type="checkbox" /> Apple Wallet</label><label><input name="googleWallet" type="checkbox" /> Google Wallet</label><label><input name="whiteLabel" type="checkbox" /> White-label</label><label><input name="advancedAnalytics" type="checkbox" /> Analítica avanzada</label></fieldset>
        <SubmitButton className="primary-button form-submit">Crear paquete en borrador</SubmitButton>
      </form>
    </section>

    <section className="enterprise-data-panel" aria-labelledby="package-directory-title">
      <div className="enterprise-panel-header"><div><h2 id="package-directory-title">Catálogo</h2><p>{failed ? "No disponible" : `${packages.length} ${packages.length === 1 ? "paquete" : "paquetes"}`}</p></div></div>
      {failed ? <div className="enterprise-empty-state is-error" role="alert"><h3>No se pudo cargar el catálogo</h3><p>Verifica que la migración 0059 esté aplicada.</p></div> : packages.length === 0 ? <div className="enterprise-empty-state"><h3>Aún no hay paquetes</h3><p>Crea el primero con el formulario anterior.</p></div> : <div className="enterprise-table-wrap"><table className="enterprise-table"><caption className="sr-only">Catálogo comercial de paquetes</caption><thead><tr><th scope="col">Paquete</th><th scope="col">Precio</th><th scope="col">Membresías</th><th scope="col">Sucursales / tarjetas</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead><tbody>{packages.map((item) => {
        const price = priceByPackage.get(item.id);
        return <tr key={item.id}><td data-label="Paquete"><strong>{item.name}</strong><br /><small>{item.code} · versión {item.version}</small></td><td data-label="Precio">{formatPrice(price)}</td><td data-label="Membresías" className="enterprise-number">{formatLimit(item.membership_limit)}</td><td data-label="Sucursales / tarjetas">{formatLimit(item.branch_limit)} / {formatLimit(item.loyalty_card_limit)}</td><td data-label="Estado"><span className={`enterprise-badge ${item.status === "ACTIVE" ? "is-active" : item.status === "ARCHIVED" ? "is-suspended" : "is-neutral"}`}>{item.status === "ACTIVE" ? "Activo" : item.status === "ARCHIVED" ? "Archivado" : "Borrador"}</span></td><td><form action={setBillingPackageStatus}><input type="hidden" name="packageId" value={item.id} /><input type="hidden" name="status" value={item.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} /><SubmitButton className="enterprise-secondary-action" confirmMessage={item.status === "ACTIVE" ? `Archivar ${item.name}? Las suscripciones existentes conservarán su snapshot.` : undefined}>{item.status === "ACTIVE" ? "Archivar" : "Activar"}</SubmitButton></form></td></tr>;
      })}</tbody></table></div>}
    </section>
  </main>;
}
