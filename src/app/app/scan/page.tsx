import Link from "next/link";
import { CustomerCardScanner } from "@/components/customer-card-scanner";
import { CustomerDetailsModal } from "@/components/customer-details-modal";
import { CustomerSearchModal } from "@/components/customer-search-modal";
import { CustomerWalletQrDelivery } from "@/components/customer-wallet-qr-delivery";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { resolveCustomerCardHandoffOrigin } from "@/lib/customers/card-handoff-origin";
import { createCustomerCardClaimQrDataUrl } from "@/lib/customers/card-qr";
import { normalizePhone } from "@/lib/customers/phone";
import { formatPurchaseAmount, parsePurchaseAmount, purchaseAmountInputStep } from "@/lib/loyalty/purchase-amount";
import { confirmCustomerPurchase, previewCustomerPurchase, redeemCustomerReward, updateCustomer } from "./actions";

type ScanPageProps = {
  searchParams: Promise<{
    customerCardId?: string;
    amount?: string;
    branchId?: string;
    error?: string;
    flow?: string;
    loyaltyCardId?: string;
    purchaseConfirmed?: string;
    q?: string;
    redeemed?: string;
    rewardId?: string;
    rewards?: string;
    searchModal?: string;
    stamps?: string;
    step?: string;
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

type CustomerWalletDelivery = {
  apple_wallet_added: boolean;
  card_token: string;
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

function customerFlowHref(customerCardId: string, loyaltyCardId: string, extra: Record<string, string> = {}) {
  return `/app/scan?${new URLSearchParams({ customerCardId, loyaltyCardId, ...extra }).toString()}`;
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 120);
  const selectedCustomerCardId = (params.customerCardId ?? "").trim();
  const selectedLoyaltyCardId = (params.loyaltyCardId ?? "").trim();
  const hasCustomerSelection = Boolean(selectedCustomerCardId && selectedLoyaltyCardId);
  const selectedFlow = params.flow === "purchase" || params.flow === "reward" ? params.flow : null;
  const flowStep = params.step === "confirm" && selectedFlow ? 3 : selectedFlow ? 2 : 1;
  const customerOverviewHref = customerFlowHref(selectedCustomerCardId, selectedLoyaltyCardId);
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
  let walletDelivery: CustomerWalletDelivery | null = null;
  let walletDeliveryFailed = false;
  let walletDeliveryQrDataUrl: string | null = null;
  let currencyCode = "MXN";
  let branches: Array<{ id: string; name: string }> = [];
  if (hasCustomerSelection) {
    await context.supabase.schema("app").rpc("expire_due_rewards");
    const [summaryResult, branchesResult, walletDeliveryResult, tenantResult] = await Promise.all([
      context.supabase.schema("app").rpc("get_staff_customer_card_summary", {
        target_customer_card_id: selectedCustomerCardId,
      }),
      context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name"),
      context.supabase.schema("app").rpc("get_staff_customer_wallet_delivery", {
        target_customer_card_id: selectedCustomerCardId,
      }),
      context.supabase.from("tenants").select("currency_code").eq("id", context.tenantId).maybeSingle(),
    ]);
    const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] as CustomerSummary | undefined : undefined;
    if (summaryResult.error || !summary || summary.loyalty_card_id !== selectedLoyaltyCardId) {
      customerSummaryFailed = true;
    } else {
      customerSummary = summary;
    }
    if (branchesResult.error) customerSummaryFailed = true;
    branches = branchesResult.data ?? [];
    if (tenantResult.data?.currency_code) currencyCode = tenantResult.data.currency_code;
    const delivery = Array.isArray(walletDeliveryResult.data)
      ? walletDeliveryResult.data[0] as CustomerWalletDelivery | undefined
      : undefined;
    if (walletDeliveryResult.error || !delivery) {
      walletDeliveryFailed = true;
    } else {
      walletDelivery = delivery;
      if (!delivery.apple_wallet_added) {
        try {
          const origin = await resolveCustomerCardHandoffOrigin();
          walletDeliveryQrDataUrl = origin
            ? await createCustomerCardClaimQrDataUrl(origin, delivery.card_token)
            : null;
        } catch {
          walletDeliveryQrDataUrl = null;
        }
      }
    }
  }

  const rewards = rewardsFrom(customerSummary?.available_rewards);
  const purchaseScopes = registrationScopes.filter((scope) => scope.loyalty_card_id === selectedLoyaltyCardId);
  const canPurchase = customerSummary?.program_status === "ACTIVE" && purchaseScopes.length > 0;
  const selectedReward = rewards.find((reward) => reward.id === params.rewardId) ?? null;
  const selectedBranch = branches.find((branch) => branch.id === params.branchId) ?? null;
  const selectedPurchaseBranch = purchaseScopes.find((scope) => scope.branch_id === params.branchId) ?? null;
  const selectedAmountMinor = params.amount ? parsePurchaseAmount(params.amount, currencyCode) : null;
  let purchasePreview: { projected_balance: number; remainder_after_minor: number; stamps_awarded: number } | null = null;
  if (selectedFlow === "purchase" && flowStep === 3 && selectedPurchaseBranch && selectedAmountMinor !== null) {
    const { data } = await context.supabase.schema("app").rpc("preview_card_purchase", {
      target_customer_card_id: selectedCustomerCardId,
      target_branch_id: selectedPurchaseBranch.branch_id,
      target_amount_minor: selectedAmountMinor,
    });
    const preview = Array.isArray(data) ? data[0] : null;
    if (preview?.result === "PREVIEW") purchasePreview = preview;
  }

  return <main className="operations-page">
    <header className="operations-page-header"><p>Clientes</p><h1 id="scan-title">Identificar cliente</h1><span>Escanea su tarjeta o búscalo por nombre o teléfono.</span></header>
    {!search && !hasCustomerSelection && params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    <section className="operations-card operations-scan-card" aria-labelledby="scan-title">
      <div className="operations-card-header"><h2>Escanear tarjeta</h2><p>Usa el QR de Apple Wallet o de la tarjeta web.</p></div>
      <CustomerCardScanner />
      <CustomerSearchModal initiallyOpen={Boolean(params.searchModal || search || params.updated) && !hasCustomerSelection}>
        {params.updated ? <p className="operations-alert is-success" role="status">Cliente actualizado.</p> : null}
        {search && params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
        <form className="operations-search-form" method="get">
          <label className="field"><span>Teléfono o nombre</span><input name="q" defaultValue={search} inputMode="search" required /></label>
          <button className="operations-primary-button" type="submit">Buscar</button>
        </form>
        {searchFailed ? <p className="operations-alert is-error" role="alert">No se pudo completar la búsqueda. Actualiza la página.</p> : null}
        {searchFailed || !search ? null : customers.length === 0 ? <div className="operations-empty-state operations-search-empty"><h2>Sin resultados</h2><p>Revisa el teléfono o intenta con menos palabras del nombre.</p></div> : <section className="operations-results" aria-label={`${customers.length} resultados`}>
          <div className="operations-results-heading"><p><strong>{customers.length}</strong> {customers.length === 1 ? "cliente encontrado" : "clientes encontrados"}</p><span>Verifica nombre, teléfono y tarjeta antes de seleccionar.</span></div>
          {customers.map((customer, index) => {
            const card = cardByCustomer.get(customer.id);
            const cardLabel = registrationScopes.find((scope) => scope.loyalty_card_id === card?.loyalty_card_id)?.card_name;
            const detailsHref = customer.status === "ACTIVE" && card?.loyalty_card_id
              ? `/app/scan?${new URLSearchParams({ customerCardId: card.id, loyaltyCardId: card.loyalty_card_id }).toString()}`
              : null;
            return <article aria-label={`Resultado ${index + 1}: ${customer.full_name}`} className="operations-customer-card" key={customer.id}>
              <div className="operations-customer-heading"><span className="enterprise-user-avatar" aria-hidden="true">{customer.full_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{customer.full_name}</strong><small>{customer.normalized_phone}</small></span><span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{customer.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></div>
              {cardLabel ? <p className="operations-result-card-name"><span>Tarjeta</span><strong>{cardLabel}</strong></p> : null}
              {detailsHref ? <Link className="operations-secondary-button" href={detailsHref}>Seleccionar cliente</Link> : <p className="operations-result-note">Este cliente no tiene una tarjeta operativa disponible en tus sucursales.</p>}
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
    {hasCustomerSelection ? <CustomerDetailsModal
      backHref={selectedFlow ? (flowStep === 3 ? customerFlowHref(selectedCustomerCardId, selectedLoyaltyCardId, { flow: selectedFlow }) : customerOverviewHref) : undefined}
      currentStep={flowStep}
      customerName={customerSummary?.customer_name ?? "Cliente no disponible"}
    >
      {customerSummaryFailed || !customerSummary ? <div className="operations-empty-state operations-search-empty"><h2>No se pudo abrir el cliente</h2><p>La tarjeta ya no está disponible o no pertenece a este negocio.</p></div> : <>
        {params.redeemed ? <p className="operations-alert is-success" role="status">Premio canjeado correctamente.</p> : null}
        {params.purchaseConfirmed ? <p className="operations-alert is-success" role="status"><strong>Compra registrada.</strong> Se agregaron {params.stamps ?? "0"} {Number(params.stamps) === 1 ? customerSummary.unit_name_singular : customerSummary.unit_name_plural}{Number(params.rewards) > 0 ? ` y ${params.rewards} premio(s).` : "."}</p> : null}
        {params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
        <section className="operations-customer-summary" aria-label="Resumen del cliente">
          <div><span>Tarjeta</span><strong>{customerSummary.card_name}</strong><small>{customerSummary.program_name}</small></div>
          <div><span>Saldo</span><strong>{customerSummary.stamp_balance}</strong><small>{customerSummary.stamp_balance === 1 ? customerSummary.unit_name_singular : customerSummary.unit_name_plural}</small></div>
          <div className={rewards.length ? "has-reward" : undefined}><span>Premios</span><strong>{rewards.length}</strong><small>{rewards.length === 1 ? "disponible" : "disponibles"}</small></div>
        </section>
        {!selectedFlow ? <>
          <section className="operations-flow-intro"><p>Información del cliente</p><h3>¿Qué deseas hacer?</h3><span>Revisa el saldo y los premios antes de elegir una operación.</span></section>
          {rewards.length ? <section className="operations-reward-summary" aria-labelledby="available-rewards-title"><div><h3 id="available-rewards-title">Premios disponibles</h3><span>El canje siempre solicitará confirmación.</span></div><ul>{rewards.map((reward) => <li key={reward.id}><strong>{reward.name}</strong><span>{reward.description || "Premio disponible para canje."}</span><small>{expirationLabel(reward.expires_at)}</small></li>)}</ul></section> : <div className="operations-no-reward"><strong>Aún no tiene premios disponibles</strong><p>Registra una compra para que continúe acumulando {customerSummary.unit_name_plural}.</p></div>}
          {walletDeliveryFailed ? <p className="operations-alert is-warning" role="status">No se pudo consultar si la tarjeta ya está agregada a Wallet.</p> : walletDelivery?.apple_wallet_added ? <p className="operations-wallet-added" role="status">✓ Tarjeta agregada a Apple Wallet</p> : walletDelivery ? <CustomerWalletQrDelivery cardToken={walletDelivery.card_token} qrDataUrl={walletDeliveryQrDataUrl} /> : null}
          <div className="operations-customer-actions operations-flow-actions">
            {rewards.length ? <Link className="operations-secondary-button" href={customerFlowHref(selectedCustomerCardId, selectedLoyaltyCardId, { flow: "reward" })}>Canjear un premio</Link> : null}
            {canPurchase ? <Link className="operations-primary-button" href={customerFlowHref(selectedCustomerCardId, selectedLoyaltyCardId, { flow: "purchase" })}>Registrar compra</Link> : <p className="operations-result-note">El programa no admite compras en tus sucursales en este momento.</p>}
          </div>
        </> : selectedFlow === "reward" && flowStep === 2 ? <section className="operations-flow-step" aria-labelledby="reward-selection-title"><div className="operations-flow-intro"><p>Canje de premio</p><h3 id="reward-selection-title">Selecciona premio y sucursal</h3><span>En el siguiente paso podrás revisar todo antes de confirmar.</span></div><form className="operations-form operations-redeem-form" method="get">
          <input name="customerCardId" type="hidden" value={selectedCustomerCardId} /><input name="loyaltyCardId" type="hidden" value={selectedLoyaltyCardId} /><input name="flow" type="hidden" value="reward" /><input name="step" type="hidden" value="confirm" />
          <fieldset className="operations-reward-choices"><legend>Premio a canjear</legend>{rewards.map((reward, index) => <label key={reward.id}><input defaultChecked={params.rewardId ? params.rewardId === reward.id : index === 0} name="rewardId" type="radio" value={reward.id} /><span><strong>{reward.name}</strong><small>{reward.description || "Premio disponible para canje."}</small><em>{expirationLabel(reward.expires_at)}</em></span></label>)}</fieldset>
          <label className="field"><span>Sucursal de canje</span><select name="branchId" required defaultValue={params.branchId ?? ""}><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <button className="operations-primary-button" disabled={!rewards.length || !branches.length} type="submit">Revisar canje</button>
        </form></section> : selectedFlow === "reward" ? <section className="operations-flow-step" aria-labelledby="reward-confirm-title"><div className="operations-flow-intro"><p>Confirmación</p><h3 id="reward-confirm-title">Confirma el canje</h3><span>Esta acción marcará el premio como utilizado.</span></div>{selectedReward && selectedBranch ? <><dl className="operations-confirmation-list"><div><dt>Cliente</dt><dd>{customerSummary.customer_name}</dd></div><div><dt>Premio</dt><dd>{selectedReward.name}</dd></div><div><dt>Sucursal</dt><dd>{selectedBranch.name}</dd></div></dl><form action={redeemCustomerReward} className="operations-form"><input name="customerCardId" type="hidden" value={selectedCustomerCardId} /><input name="loyaltyCardId" type="hidden" value={selectedLoyaltyCardId} /><input name="rewardId" type="hidden" value={selectedReward.id} /><input name="branchId" type="hidden" value={selectedBranch.id} /><SubmitButton className="operations-primary-button">Confirmar canje</SubmitButton></form></> : <p className="operations-alert is-error" role="alert">El premio o la sucursal ya no están disponibles. Vuelve al paso anterior.</p>}</section> : selectedFlow === "purchase" && flowStep === 2 ? <section className="operations-flow-step" aria-labelledby="purchase-data-title"><div className="operations-flow-intro"><p>Registro de compra</p><h3 id="purchase-data-title">Captura los datos</h3><span>SwiftWallet calculará el saldo antes de pedir confirmación.</span></div><form action={previewCustomerPurchase} className="operations-form">
          <input name="customerCardId" type="hidden" value={selectedCustomerCardId} /><input name="loyaltyCardId" type="hidden" value={selectedLoyaltyCardId} />
          <label className="field"><span>Sucursal de compra</span><select name="branchId" required defaultValue={params.branchId ?? ""}><option value="">Selecciona una sucursal</option>{purchaseScopes.map((scope) => <option key={scope.branch_id} value={scope.branch_id}>{scope.branch_name}</option>)}</select></label>
          <label className="field"><span>Monto de compra ({currencyCode})</span><input name="amount" type="number" inputMode="decimal" min={purchaseAmountInputStep(currencyCode)} step={purchaseAmountInputStep(currencyCode)} defaultValue={params.amount ?? ""} placeholder="0.00" required /><small>Ingresa el importe tal como aparece en el ticket.</small></label>
          <SubmitButton className="operations-primary-button" disabled={!purchaseScopes.length}>Calcular y revisar</SubmitButton>
        </form></section> : <section className="operations-flow-step" aria-labelledby="purchase-confirm-title"><div className="operations-flow-intro"><p>Confirmación</p><h3 id="purchase-confirm-title">Revisa la compra</h3><span>El servidor volverá a calcular todo al confirmar.</span></div>{selectedPurchaseBranch && selectedAmountMinor !== null && purchasePreview ? <><section className="operations-preview"><div><span>Se agregarán</span><strong>{purchasePreview.stamps_awarded}</strong></div><div><span>Nuevo saldo</span><strong>{purchasePreview.projected_balance}</strong></div><div><span>Monto</span><strong>{formatPurchaseAmount(selectedAmountMinor, currencyCode)}</strong></div><p>Cálculo realizado por SwiftWallet</p></section><form action={confirmCustomerPurchase} className="operations-form"><input name="customerCardId" type="hidden" value={selectedCustomerCardId} /><input name="loyaltyCardId" type="hidden" value={selectedLoyaltyCardId} /><input name="branchId" type="hidden" value={selectedPurchaseBranch.branch_id} /><input name="amount" type="hidden" value={params.amount} /><label className="field"><span>Número de ticket</span><input name="ticketNumber" required autoComplete="off" /><small>Sucursal: {selectedPurchaseBranch.branch_name}</small></label><SubmitButton className="operations-primary-button">Confirmar compra</SubmitButton></form></> : <p className="operations-alert is-error" role="alert">La previsualización ya no es válida. Vuelve al paso anterior para recalcular.</p>}</section>}
      </>}
    </CustomerDetailsModal> : null}
  </main>;
}
