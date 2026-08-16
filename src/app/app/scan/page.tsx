import Link from "next/link";
import { CustomerCardScanner } from "@/components/customer-card-scanner";
import { CustomerSearchModal } from "@/components/customer-search-modal";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/customers/phone";
import { updateCustomer } from "./actions";

type ScanPageProps = {
  searchParams: Promise<{ error?: string; q?: string; updated?: string }>;
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
  loyalty_card_id: string;
};

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 120);
  const canEdit = context.access.role === "MANAGER";
  let customers: CustomerResult[] = [];
  let customerCards: CustomerCard[] = [];
  let registrationScopes: RegistrationScope[] = [];
  let searchFailed = false;

  if (search) {
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
      const [cardsResult, scopesResult] = await Promise.all([
        context.supabase
          .from("customer_cards")
          .select("id,customer_id,loyalty_card_id,status")
          .in("customer_id", customers.map((customer) => customer.id)),
        context.supabase.schema("app").rpc("get_staff_registration_scopes"),
      ]);
      searchFailed = Boolean(cardsResult.error || scopesResult.error);
      customerCards = (cardsResult.data ?? []) as CustomerCard[];
      registrationScopes = (scopesResult.data ?? []) as RegistrationScope[];
    }
  }

  const availableCardIds = new Set(registrationScopes.map((scope) => scope.loyalty_card_id));
  const cardByCustomer = new Map(
    customerCards
      .filter((card) => card.status === "ACTIVE" && card.loyalty_card_id && availableCardIds.has(card.loyalty_card_id))
      .map((card) => [card.customer_id, card]),
  );

  return <main className="operations-page">
    <header className="operations-page-header"><p>Clientes</p><h1 id="scan-title">Identificar cliente</h1><span>Escanea su tarjeta o búscalo por nombre o teléfono.</span></header>
    {!search && params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    <section className="operations-card operations-scan-card" aria-labelledby="scan-title">
      <div className="operations-card-header"><h2>Escanear tarjeta</h2><p>Usa el QR de Apple Wallet o de la tarjeta web.</p></div>
      <CustomerCardScanner />
      <CustomerSearchModal initiallyOpen={Boolean(search || params.updated)}>
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
            const purchaseHref = customer.status === "ACTIVE" && card?.loyalty_card_id
              ? `/app/purchase?${new URLSearchParams({ customerCardId: card.id, loyaltyCardId: card.loyalty_card_id }).toString()}`
              : null;
            return <article className="operations-customer-card" key={customer.id}>
              <div className="operations-customer-heading"><span className="enterprise-user-avatar" aria-hidden="true">{customer.full_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{customer.full_name}</strong><small>{customer.normalized_phone}</small></span><span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{customer.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></div>
              {purchaseHref ? <Link className="operations-secondary-button" href={purchaseHref}>Registrar compra</Link> : <p className="operations-result-note">Este cliente no tiene una tarjeta operativa disponible en tus sucursales.</p>}
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
  </main>;
}
