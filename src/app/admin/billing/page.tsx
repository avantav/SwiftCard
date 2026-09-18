import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { getCurrencyFractionDigits } from "@/lib/admin/program";
import { billingSubscriptionBadge, billingSubscriptionLabel, getBillingUsageState } from "@/lib/billing/summary";

type Subscription = {
  id: string; status: string; billing_interval: "MONTH" | "YEAR"; currency_code: string; amount_minor: number;
  package_name_snapshot: string; membership_limit_snapshot: number | null; branch_limit_snapshot: number | null;
  loyalty_card_limit_snapshot: number | null; current_period_start: string; current_period_end: string;
  trial_ends_at: string | null; cancel_at_period_end: boolean;
};
type Usage = { current_memberships: number; peak_memberships: number; measured_at: string };
type Redemption = {
  promotion_code_snapshot: string; discount_type_snapshot: "PERCENT" | "FIXED_AMOUNT";
  percent_off_basis_points_snapshot: number | null; amount_off_minor_snapshot: number | null;
  currency_code_snapshot: string | null; covered_memberships: number; redeemed_at: string;
};
type Referral = { attributed_code_snapshot: string; attributed_at: string; converted_at: string | null };

function money(amountMinor: number, currency: string) {
  const digits = getCurrencyFractionDigits(currency);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amountMinor / (10 ** digits));
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function limit(value: number | null) {
  return value === null ? "Sin límite" : new Intl.NumberFormat("es-MX").format(value);
}

function promotionDiscount(item: Redemption) {
  if (item.discount_type_snapshot === "PERCENT") return `${(item.percent_off_basis_points_snapshot ?? 0) / 100}%`;
  return money(item.amount_off_minor_snapshot ?? 0, item.currency_code_snapshot ?? "MXN");
}

export default async function AdminBillingPage() {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");

  const [subscriptionResponse, branchCountResponse, cardCountResponse, referralResponse] = await Promise.all([
    context.supabase.from("tenant_subscriptions")
      .select("id,status,billing_interval,currency_code,amount_minor,package_name_snapshot,membership_limit_snapshot,branch_limit_snapshot,loyalty_card_limit_snapshot,current_period_start,current_period_end,trial_ends_at,cancel_at_period_end")
      .eq("tenant_id", context.tenantId).is("ended_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    context.supabase.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", context.tenantId).eq("status", "ACTIVE"),
    context.supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("tenant_id", context.tenantId).neq("status", "ARCHIVED"),
    context.supabase.from("billing_affiliate_referrals").select("attributed_code_snapshot,attributed_at,converted_at").eq("tenant_id", context.tenantId).maybeSingle()
  ]);
  const subscription = subscriptionResponse.data as Subscription | null;
  const [usageResponse, redemptionResponse] = subscription ? await Promise.all([
    context.supabase.from("billing_membership_usage").select("current_memberships,peak_memberships,measured_at").eq("subscription_id", subscription.id).order("period_start", { ascending: false }).limit(1).maybeSingle(),
    context.supabase.from("billing_promotion_redemptions").select("promotion_code_snapshot,discount_type_snapshot,percent_off_basis_points_snapshot,amount_off_minor_snapshot,currency_code_snapshot,covered_memberships,redeemed_at").eq("subscription_id", subscription.id).order("redeemed_at", { ascending: false }).limit(1).maybeSingle()
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const usage = usageResponse.data as Usage | null;
  const redemption = redemptionResponse.data as Redemption | null;
  const referral = referralResponse.data as Referral | null;
  const failed = Boolean(subscriptionResponse.error || branchCountResponse.error || cardCountResponse.error || referralResponse.error || usageResponse.error || redemptionResponse.error);

  if (failed) return <main className="enterprise-page"><header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración / Facturación</p><h1>Plan y uso</h1><p>Consulta el estado comercial de tu cuenta.</p></div></header><div className="enterprise-empty-state is-error" role="alert"><h3>No se pudo cargar la facturación</h3><p>Actualiza la página o contacta al equipo de soporte.</p></div></main>;
  if (!subscription) return <main className="enterprise-page"><header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración / Facturación</p><h1>Plan y uso</h1><p>Consulta el estado comercial de tu cuenta.</p></div></header><div className="enterprise-empty-state"><h3>Aún no hay una suscripción asignada</h3><p>Tu operación de fidelidad continúa disponible. Contacta al equipo comercial para asignar un paquete.</p></div></main>;

  const currentMemberships = usage?.current_memberships ?? 0;
  const peakMemberships = usage?.peak_memberships ?? currentMemberships;
  const usageState = getBillingUsageState(peakMemberships, subscription.membership_limit_snapshot);
  const alert = usageState.level === "LIMIT"
    ? "El pico del periodo alcanzó o superó el límite contratado. Esta vista todavía no bloquea nuevas membresías."
    : usageState.level === "CRITICAL"
      ? "El pico del periodo alcanzó al menos 90% del límite. Revisa una ampliación de paquete."
      : usageState.level === "WARNING"
        ? "El pico del periodo alcanzó al menos 80% del límite contratado."
        : null;

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración / Facturación</p><h1>Plan y uso</h1><p>Consulta tu paquete, periodo y consumo de membresías.</p></div></header>
    {alert ? <p className={`enterprise-alert ${usageState.level === "LIMIT" || usageState.level === "CRITICAL" ? "is-error" : "is-warning"}`} role="status"><strong>Atención de capacidad.</strong> {alert}</p> : null}

    <section aria-label="Resumen de suscripción" className="enterprise-metrics billing-summary-metrics">
      <article className="enterprise-metric"><span>Paquete</span><strong className="enterprise-metric-text">{subscription.package_name_snapshot}</strong><small>{money(subscription.amount_minor, subscription.currency_code)} / {subscription.billing_interval === "MONTH" ? "mes" : "año"}</small></article>
      <article className="enterprise-metric"><span>Estado</span><strong className="enterprise-metric-text"><span className={`enterprise-badge ${billingSubscriptionBadge(subscription.status)}`}>{billingSubscriptionLabel(subscription.status)}</span></strong><small>{subscription.cancel_at_period_end ? "Termina al cerrar el periodo" : "Renovación configurada"}</small></article>
      <article className="enterprise-metric"><span>Periodo actual</span><strong className="enterprise-metric-text">{date(subscription.current_period_start)}</strong><small>Hasta {date(subscription.current_period_end)}</small></article>
      <article className="enterprise-metric"><span>Membresías actuales</span><strong>{currentMemberships}</strong><small>Pico del periodo: {peakMemberships}</small></article>
    </section>

    <section className="enterprise-content-card billing-usage-card" aria-labelledby="membership-usage-title">
      <div className="billing-usage-heading"><div><h2 id="membership-usage-title">Uso de membresías</h2><p>El pico del periodo es la referencia comercial y no disminuye al desactivar registros.</p></div><strong>{usageState.percent === null ? `${peakMemberships} · sin límite` : `${usageState.percent}%`}</strong></div>
      <div className={`billing-usage-track is-${usageState.level.toLowerCase()}`} role="progressbar" aria-label="Uso del límite de membresías" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usageState.percent === null ? undefined : usageState.visualPercent}><span style={{ width: `${usageState.percent === null ? 0 : usageState.visualPercent}%` }} /></div>
      <p>{peakMemberships} de {limit(subscription.membership_limit_snapshot)} membresías en el pico de este periodo.</p>
    </section>

    <section className="enterprise-data-panel" aria-labelledby="commercial-limits-title"><div className="enterprise-panel-header"><div><h2 id="commercial-limits-title">Capacidad contratada</h2><p>Uso actual frente al snapshot de tu suscripción</p></div></div><div className="enterprise-table-wrap"><table className="enterprise-table"><caption className="sr-only">Límites comerciales del tenant</caption><thead><tr><th scope="col">Dimensión</th><th scope="col">Uso actual</th><th scope="col">Límite</th></tr></thead><tbody><tr><td data-label="Dimensión"><strong>Membresías</strong></td><td data-label="Uso actual">{currentMemberships} actuales · {peakMemberships} pico</td><td data-label="Límite">{limit(subscription.membership_limit_snapshot)}</td></tr><tr><td data-label="Dimensión"><strong>Sucursales activas</strong></td><td data-label="Uso actual">{branchCountResponse.count ?? 0}</td><td data-label="Límite">{limit(subscription.branch_limit_snapshot)}</td></tr><tr><td data-label="Dimensión"><strong>Tarjetas configuradas</strong></td><td data-label="Uso actual">{cardCountResponse.count ?? 0}</td><td data-label="Límite">{limit(subscription.loyalty_card_limit_snapshot)}</td></tr></tbody></table></div></section>

    <section className="enterprise-content-card" aria-labelledby="commercial-attribution-title"><h2 id="commercial-attribution-title">Promoción y atribución</h2><div className="billing-commercial-details"><div><span>Promoción aplicada</span>{redemption ? <><strong>{redemption.promotion_code_snapshot} · {promotionDiscount(redemption)}</strong><small>{redemption.covered_memberships} membresías cubiertas · aplicada {date(redemption.redeemed_at)}</small></> : <strong>Sin promoción aplicada</strong>}</div><div><span>Afiliado atribuido</span>{referral ? <><strong>{referral.attributed_code_snapshot}</strong><small>Atribuido {date(referral.attributed_at)}{referral.converted_at ? ` · convertido ${date(referral.converted_at)}` : " · conversión pendiente"}</small></> : <strong>Sin afiliado atribuido</strong>}</div></div></section>
  </main>;
}
