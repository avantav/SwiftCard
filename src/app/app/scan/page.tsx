import Link from "next/link";
import { CustomerCardScanner } from "@/components/customer-card-scanner";
import { CustomerDetailsModal } from "@/components/customer-details-modal";
import { CustomerSearchModal } from "@/components/customer-search-modal";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/customers/phone";
import { redeemCustomerReward, updateCustomer } from "./actions";

type ScanPageProps = {
  searchParams: Promise<{
    customerCardId?: string;
    error?: string;
    loyaltyCardId?: string;
    q?: string;
    redeemed?: string;
    updated?: string;
  }>;
};

type CustomerResult = {
  birth_date: string | null;
  email: string | null;
  full_name: string;
  id: string;
  normalized_phone: string;
  source_branch_id: string;
  status: "ACTIVE" | "INACTIVE";
};

type CustomerCard = {
  customer_id: string;
  id: string;
  loyalty_card_id: string | null;
  status: "ACTIVE" | "REVOKED";
};

type RegistrationScope = {
  branch_id: string;
  branch_name: string;
  card_name: string;
  loyalty_card_id: string;
};

type RewardSummary = {
  description: string;
  expires_at: string | null;
  id: string;
  name: string;
};

type CustomerSummary = {
  available_rewards: unknown;
  card_name: string;
  customer_card_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  loyalty_card_id: string;
  program_name: string;
  program_status: string;
  stamp_balance: number;
  unit_name_plural: string;
  unit_name_singular: string;
};

function rewardsFrom(value: unknown): RewardSummary[] {
  if (!Array.isArray(value)) return [];
  return value.filter((reward): reward is RewardSummary => Boolean(
    reward
    && typeof reward === "object"
    && typeof reward.id === "string"
    && typeof reward.name === "string"
    && typeof reward.description === "string"
    && (typeof reward.expires_at === "string" || reward.expires_at === null)
  ));
}

function expirationLabel(value: string | null) {
  if (!value) return "Sin vencimiento";
  return `Vence ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value))}`;
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 120);
  const selectedCustomerCardId = (params.customerCardId ?? "").trim();
  const selectedLoyaltyCardId = (params.loyaltyCardId ?? "").trim();
  const hasCustomerSelection = Boolean(selectedCustomerCardId && selectedLoyaltyCardId);
  const canEdit = context.access.role === "MANAGER";
  let customers: CustomerResult[] = [];
  let customerCards: CustomerCard[] = [];
  let searchFailed = false;

  const scopesResult = await context.supabase.schema("app").rpc("get_staff_registration_scopes");
  const registrationScopes = (scopesResult.data ?? []) as RegistrationScope[];
  const availableCardIds = new Set(registrationScopes.map((scope) => scope.loyalty_card_id));

  if (search && !hasCustomerSelection) {
    const nameResult = await context.supabase
      .from("customers")
      .select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id")
      .ilike("full_name", `%${search}%`)
      .order("full_name")
      .limit(50);
    searchFailed = Boolean(nameResult.error);
    customers = (nameResult.data ?? []) as CustomerResult[];

    const phone = normalizePhone(search);
    if (phone.ok) {
      const phoneResult = await context.supabase
        .from("customers")
        .select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id")
        .eq("normalized_phone", phone.value)
        .limit(1);
      searchFailed = searchFailed || Boolean(phoneResult.error);
      for (const customer of (phoneResult.data ?? []) as CustomerResult[]) {
        if (!customers.some((item) => item.id === customer.id)) customers.push(customer);
      }
    }

    if (!searchFailed && customers.length) {
      const cardsResult = await context.supabase
        .from("customer_cards")
        .select("id,customer_id,loyalty_card_id,status")
        .in("customer_id", customers.map((customer) => customer.id));
      searchFailed = Boolean(cardsResult.error || scopesResult.error);
      customerCards = (cardsResult.data ?? []) as CustomerCard[];
    }
  }

  const cardByCustomer = new Map(
    customerCards
      .filter((card) => card.status === "ACTIVE" && card.loyalty_card_id && availableCardIds.has(card.loyalty_card_id))
      .map((card) => [card.customer_id, card]),
  );

  let customerSummary: CustomerSummary | null = null;
  let customerSummaryFailed = false;
  let branches: Array<{ id: string; name: string }> = [];
  if (hasCustomerSelection) {
    await context.supabase.schema("app").rpc("expire_due_rewards");
    const [summaryResult, branchesResult] = await Promise.all([
      context.supabase.schema("app").rpc("get_staff_customer_card_summary", {
        target_customer_card_id: selectedCustomerCardId,
      }),
      context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name"),
    ]);
    const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] as CustomerSummary | undefined : undefined;
    if (summaryResult.error || !summary || summary.loyalty_card_id !== selectedLoyaltyCardId) {
      customerSummaryFailed = true;
    } else {
      customerSummary = summary;
    }
    if (branchesResult.error) customerSummaryFailed = true;
    branches = branchesResult.data ?? [];
  }

  const rewards = rewardsFrom(customerSummary?.available_rewards);
  const purchaseScopes = registrationScopes.filter((scope) => scope.loyalty_card_id === selectedLoyaltyCardId);
  const purchaseHref = customerSummary?.program_status === "ACTIVE" && purchaseScopes.length
    ? `/app/purchase?${new URLSearchParams({ customerCardId: selectedCustomerCardId, loyaltyCardId: selectedLoyaltyCardId }).toString()}`
    : null;

  return <main className="operations-page">
    <header className="operations-page-header"><p>Clientes</p><h1 id="scan-title">Identificar cliente</h1><span>Escanea su tarjeta o búscalo por nombre o teléfono.</span></header>
    {!search && !hasCustomerSelection && params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    <section className="operations-card operations-scan-card" aria-labelledby="scan-title">
      <div className="operations-card-header"><h2>Escanear tarjeta</h2><p>Usa el QR de Apple Wallet o de la tarjeta web.</p></div>
      <CustomerCardScanner />
      <CustomerSearchModal initiallyOpen={Boolean(search || params.updated) && !hasCustomerSelection}>
        {params.updated ? <p className="operations-alert is-success" role="status">Cliente actualizado.</p> : null}
        {search && params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
        <form className="operations-search-form" method="get">
          <label className="field"><span>Teléfono o nombre</span><input name="q" defaultValue={search} inputMode="search" /></label>
          <button className="operations-primary-button" type="submit">Buscar</button>
        </form>
        {searchFailed ? <p className="operations-alert is-error" role="alert">No se pudo completar la búsqueda. Actualiza la página.</p> : null}
        {searchFailed || !search ? null : customers.length === 0 ? <div className="operations-empty-state operations-search-empty"><h2>Sin resultados</h2><p>Revisa el teléfono o intenta con menos palabras del nombre.</p></div> : <section className="operations-results" aria-label={`${customers.length} resultados`}>
          <p className="operations-results-count">{customers.length} {customers.length === 1 ? "cliente" : "clientes"}</p>
          {customers.map((customer) => {
            const card = cardByCustomer.get(customer.id);
            const detailsHref = customer.status === "ACTIVE" && card?.loyalty_card_id
              ? `/app/scan?${new URLSearchParams({ customerCardId: card.id, loyaltyCardId: card.loyalty_card_id }).toString()}`
              : null;
            return <article className="operations-customer-card" key={customer.id}>
              <div className="operations-customer-heading"><span className="enterprise-user-avatar" aria-hidden="true">{customer.full_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{customer.full_name}</strong><small>{customer.normalized_phone}</small></span><span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{customer.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></div>
              {detailsHref ? <Link className="operations-secondary-button" href={detailsHref}>Ver cliente</Link> : <p className="operations-result-note">Este cliente no tiene una tarjeta operativa disponible en tus sucursales.</p>}
              {canEdit ? <details className="operations-edit-details"><summary>Editar cliente</summary><form className="operations-form" action={updateCustomer}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="returnQuery" value={search} />
                <label className="field"><span>Nombre</span><input name="fullName" defaultValue={customer.full_name} required /></label>
                <label className="field"><span>Teléfono</span><input name="phone" defaultValue={customer.normalized_phone} required /></label>
                <label className="field"><span>Correo <small>(opcional)</small></span><input name="email" type="email" defaultValue={customer.email ?? ""} /></label>
                <label className="field"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="birthDate" type="date" defaultValue={customer.birth_date ?? ""} /></label>
                <label className="check-field operations-check"><input name="privacyConsent" type="checkbox" defaultChecked /><span>Confirmo el consentimiento registrado.</span></label>
                <label className="field"><span>Estado</span><select name="status" defaultValue={customer.status}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
                <SubmitButton className="operations-secondary-button">Guardar cambios</SubmitButton>
              </form></details> : null}
            </article>;
          })}
        </section>}
      </CustomerSearchModal>
    </section>
    {hasCustomerSelection ? <CustomerDetailsModal customerName={customerSummary?.customer_name ?? "Cliente no disponible"}>
      {customerSummaryFailed || !customerSummary ? <div className="operations-empty-state operations-search-empty"><h2>No se pudo abrir el cliente</h2><p>La tarjeta ya no está disponible o no pertenece a este negocio.</p></div> : <>
        {params.redeemed ? <p className="operations-alert is-success" role="status">Premio canjeado correctamente.</p> : null}
        {params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
        <section className="operations-customer-summary" aria-label="Resumen del cliente">
          <div><span>Tarjeta</span><strong>{customerSummary.card_name}</strong><small>{customerSummary.program_name}</small></div>
          <div><span>Saldo</span><strong>{customerSummary.stamp_balance}</strong><small>{customerSummary.stamp_balance === 1 ? customerSummary.unit_name_singular : customerSummary.unit_name_plural}</small></div>
          <div className={rewards.length ? "has-reward" : undefined}><span>Premios</span><strong>{rewards.length}</strong><small>{rewards.length === 1 ? "disponible" : "disponibles"}</small></div>
        </section>
        {rewards.length ? <form action={redeemCustomerReward} className="operations-form operations-redeem-form">
          <input name="customerCardId" type="hidden" value={selectedCustomerCardId} />
          <input name="loyaltyCardId" type="hidden" value={selectedLoyaltyCardId} />
          <fieldset className="operations-reward-choices"><legend>Premios disponibles</legend>{rewards.map((reward, index) => <label key={reward.id}><input defaultChecked={index === 0} name="rewardId" type="radio" value={reward.id} /><span><strong>{reward.name}</strong><small>{reward.description || "Premio disponible para canje."}</small><em>{expirationLabel(reward.expires_at)}</em></span></label>)}</fieldset>
          <label className="field"><span>Sucursal de canje</span><select name="branchId" required defaultValue=""><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <SubmitButton className="operations-secondary-button" disabled={!branches.length}>Canjear premio</SubmitButton>
        </form> : <div className="operations-no-reward"><strong>Aún no tiene premios disponibles</strong><p>Registra una compra para que continúe acumulando {customerSummary.unit_name_plural}.</p></div>}
        <div className="operations-customer-actions">
          {purchaseHref ? <Link className="operations-primary-button" href={purchaseHref}>Registrar compra</Link> : <p className="operations-result-note">El programa no admite compras en tus sucursales en este momento.</p>}
        </div>
      </>}
    </CustomerDetailsModal> : null}
  </main>;
}
