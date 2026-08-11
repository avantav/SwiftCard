import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ADMIN_CUSTOMER_PAGE_SIZE,
  adminCustomerPageHref,
  parseAdminCustomerDirectoryParams,
  resolveAdminCustomerSearch,
  type AdminCustomerDirectoryParams,
} from "@/lib/admin/customers";
import { canViewTenantCustomers } from "@/lib/auth/permissions";
import { requireInternalArea } from "@/lib/auth/server";

type CustomerDirectoryPageProps = {
  searchParams: Promise<AdminCustomerDirectoryParams>;
};

type CustomerRow = {
  id: string;
  full_name: string;
  normalized_phone: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  registration_method: "SELF_SERVICE" | "EMPLOYEE";
  source_branch_id: string;
  created_at: string;
};

type CustomerCardRow = {
  customer_id: string;
  status: "ACTIVE" | "REVOKED";
};

type WalletPassRow = {
  customer_id: string;
  status: "PENDING" | "ACTIVE" | "UPDATE_PENDING" | "REVOKED" | "FAILED";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formattedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function walletBadge(input: {
  appleEnabled: boolean;
  cardStatus: CustomerCardRow["status"] | null;
  customerStatus: CustomerRow["status"];
  dataAvailable: boolean;
  passStatus: WalletPassRow["status"] | null;
}) {
  if (!input.dataAvailable) {
    return { className: "is-error", label: "Sin datos" };
  }
  if (!input.appleEnabled) {
    return { className: "is-suspended", label: "Deshabilitado" };
  }
  if (input.customerStatus !== "ACTIVE" || input.cardStatus !== "ACTIVE") {
    return { className: "is-neutral", label: "No disponible" };
  }
  switch (input.passStatus) {
    case "ACTIVE":
      return { className: "is-active", label: "Generada" };
    case "UPDATE_PENDING":
    case "PENDING":
      return { className: "is-suspended", label: "Pendiente" };
    case "FAILED":
      return { className: "is-error", label: "Error" };
    case "REVOKED":
      return { className: "is-neutral", label: "Revocada" };
    default:
      return { className: "is-neutral", label: "Sin generar" };
  }
}

export default async function CustomerDirectoryPage({
  searchParams,
}: CustomerDirectoryPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (!canViewTenantCustomers(context.access) || !context.tenantId) {
    redirect("/admin");
  }

  const filters = parseAdminCustomerDirectoryParams(await searchParams);
  const search = resolveAdminCustomerSearch(filters.search);
  const offset = (filters.page - 1) * ADMIN_CUSTOMER_PAGE_SIZE;
  let customersQuery = context.supabase
    .from("customers")
    .select(
      "id,full_name,normalized_phone,email,status,registration_method,source_branch_id,created_at",
      { count: "exact" },
    )
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + ADMIN_CUSTOMER_PAGE_SIZE - 1);

  if (filters.status !== "ALL") {
    customersQuery = customersQuery.eq("status", filters.status);
  }
  if (search?.kind === "PHONE") {
    customersQuery = customersQuery.eq("normalized_phone", search.value);
  } else if (search?.kind === "NAME") {
    customersQuery = customersQuery.ilike("full_name", `%${search.value}%`);
  }

  const [customersResult, branchesResult, designResult] = await Promise.all([
    customersQuery,
    context.supabase
      .from("branches")
      .select("id,name")
      .eq("tenant_id", context.tenantId)
      .order("name"),
    context.supabase
      .from("tenant_wallet_designs")
      .select("apple_enabled")
      .eq("tenant_id", context.tenantId)
      .maybeSingle(),
  ]);
  const customers = (customersResult.data ?? []) as CustomerRow[];
  const customerIds = customers.map((customer) => customer.id);
  const emptyResult = { data: [], error: null };
  const [cardsResult, balancesResult, rewardsResult, walletPassesResult] =
    customerIds.length
      ? await Promise.all([
          context.supabase
            .from("customer_cards")
            .select("customer_id,status")
            .eq("tenant_id", context.tenantId)
            .in("customer_id", customerIds),
          context.supabase
            .from("customer_loyalty_balances")
            .select("customer_id,stamp_balance")
            .eq("tenant_id", context.tenantId)
            .in("customer_id", customerIds),
          context.supabase
            .from("rewards")
            .select("customer_id")
            .eq("tenant_id", context.tenantId)
            .eq("status", "AVAILABLE")
            .in("customer_id", customerIds)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
          context.supabase
            .from("wallet_passes")
            .select("customer_id,status")
            .eq("tenant_id", context.tenantId)
            .eq("provider", "APPLE")
            .in("customer_id", customerIds),
        ])
      : [emptyResult, emptyResult, emptyResult, emptyResult];

  const failed = Boolean(customersResult.error);
  const relatedFailed = Boolean(
    branchesResult.error ||
      designResult.error ||
      cardsResult.error ||
      balancesResult.error ||
      rewardsResult.error ||
      walletPassesResult.error,
  );
  const total = customersResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_CUSTOMER_PAGE_SIZE));
  const branchNames = new Map(
    (branchesResult.data ?? []).map((branch) => [branch.id, branch.name]),
  );
  const cards = new Map(
    ((cardsResult.data ?? []) as CustomerCardRow[]).map((card) => [
      card.customer_id,
      card.status,
    ]),
  );
  const balances = new Map(
    (balancesResult.data ?? []).map((balance) => [
      balance.customer_id,
      balance.stamp_balance,
    ]),
  );
  const rewards = new Map<string, number>();
  for (const reward of rewardsResult.data ?? []) {
    rewards.set(reward.customer_id, (rewards.get(reward.customer_id) ?? 0) + 1);
  }
  const walletPasses = new Map(
    ((walletPassesResult.data ?? []) as WalletPassRow[]).map((pass) => [
      pass.customer_id,
      pass.status,
    ]),
  );
  const appleEnabled = designResult.data?.apple_enabled === true;
  const hasFilters = Boolean(filters.search || filters.status !== "ALL");

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Datos</p>
          <h1 id="customers-title">Clientes</h1>
          <p>Consulta el estado, tarjeta y saldo de los clientes del tenant.</p>
        </div>
      </header>

      <section className="enterprise-filter-panel" aria-label="Filtros de clientes">
        <form className="enterprise-filter-form admin-customer-filters" method="get">
          <label className="field">
            <span>Nombre o teléfono</span>
            <input
              defaultValue={filters.search}
              maxLength={80}
              name="q"
              placeholder="Ej. María López o 811 111 1111"
              type="search"
            />
          </label>
          <label className="field">
            <span>Estado del cliente</span>
            <select defaultValue={filters.status} name="status">
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          {hasFilters ? <Link className="enterprise-secondary-action" href="/admin/customers">Limpiar</Link> : null}
        </form>
      </section>

      {relatedFailed && !failed ? (
        <p className="enterprise-alert is-warning" role="alert">
          Algunos datos complementarios no están disponibles. Los clientes sí se muestran, pero ciertos estados pueden aparecer como “—”.
        </p>
      ) : null}

      <section className="enterprise-data-panel" aria-labelledby="customer-directory-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="customer-directory-title">Directorio de clientes</h2>
            <p>{total} {total === 1 ? "cliente" : "clientes"}{hasFilters ? " con los filtros actuales" : " registrados"}</p>
          </div>
          <span className={`enterprise-badge ${designResult.error ? "is-error" : appleEnabled ? "is-active" : "is-suspended"}`}>
            Apple Wallet {designResult.error ? "sin datos" : appleEnabled ? "habilitado" : "deshabilitado"}
          </span>
        </div>

        {failed ? (
          <div className="enterprise-empty-state is-error admin-compact-empty" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudieron cargar los clientes</h3>
            <p>Actualiza la página para volver a intentarlo.</p>
          </div>
        ) : customers.length ? (
          <>
            <div className="enterprise-table-wrap">
              <table className="enterprise-table admin-customer-table">
                <caption className="sr-only">Clientes registrados en el tenant</caption>
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Sucursal de alta</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Tarjeta</th>
                    <th scope="col">Sellos</th>
                    <th scope="col">Premios</th>
                    <th scope="col">Apple Wallet</th>
                    <th scope="col">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const cardStatus = cards.get(customer.id) ?? null;
                    const passStatus = walletPasses.get(customer.id) ?? null;
                    const wallet = walletBadge({
                      appleEnabled,
                      cardStatus,
                      customerStatus: customer.status,
                      dataAvailable: !Boolean(
                        designResult.error ||
                          cardsResult.error ||
                          walletPassesResult.error,
                      ),
                      passStatus,
                    });
                    return (
                      <tr key={customer.id}>
                        <td data-label="Cliente">
                          <div className="enterprise-tenant-cell admin-customer-identity">
                            <span aria-hidden="true">{initials(customer.full_name)}</span>
                            <div>
                              <strong>{customer.full_name}</strong>
                              <small>{customer.normalized_phone}{customer.email ? ` · ${customer.email}` : ""}</small>
                            </div>
                          </div>
                        </td>
                        <td data-label="Sucursal de alta">{branchNames.get(customer.source_branch_id) ?? "No disponible"}</td>
                        <td data-label="Estado">
                          <span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>
                            {customer.status === "ACTIVE" ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td data-label="Tarjeta">
                          {cardStatus ? (
                            <span className={`enterprise-badge ${cardStatus === "ACTIVE" ? "is-active" : "is-neutral"}`}>
                              {cardStatus === "ACTIVE" ? "Activa" : "Revocada"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="enterprise-number" data-label="Sellos">{balancesResult.error ? "—" : balances.get(customer.id) ?? 0}</td>
                        <td className="enterprise-number" data-label="Premios">{rewardsResult.error ? "—" : rewards.get(customer.id) ?? 0}</td>
                        <td data-label="Apple Wallet"><span className={`enterprise-badge ${wallet.className}`}>{wallet.label}</span></td>
                        <td data-label="Registro">
                          <span className="admin-customer-date">{formattedDate(customer.created_at)}</span>
                          <small className="admin-customer-method">{customer.registration_method === "SELF_SERVICE" ? "Autorregistro" : "Registrado por personal"}</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <nav className="admin-customer-pagination" aria-label="Paginación de clientes">
                <p>Página {filters.page} de {totalPages}</p>
                <div>
                  {filters.page > 1 ? (
                    <Link className="enterprise-secondary-action" href={adminCustomerPageHref({ ...filters, page: filters.page - 1 })}>Anterior</Link>
                  ) : <span className="enterprise-secondary-action is-disabled" aria-disabled="true">Anterior</span>}
                  {filters.page < totalPages ? (
                    <Link className="enterprise-secondary-action" href={adminCustomerPageHref({ ...filters, page: filters.page + 1 })}>Siguiente</Link>
                  ) : <span className="enterprise-secondary-action is-disabled" aria-disabled="true">Siguiente</span>}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="enterprise-empty-state admin-compact-empty">
            <span className="enterprise-empty-icon" aria-hidden="true">{hasFilters ? "?" : "+"}</span>
            <h3>{hasFilters ? "Sin resultados" : "Aún no hay clientes"}</h3>
            <p>{hasFilters ? "Ajusta o limpia los filtros para ampliar la búsqueda." : "Los clientes aparecerán aquí después de su registro."}</p>
            {hasFilters ? <Link className="enterprise-secondary-action" href="/admin/customers">Limpiar filtros</Link> : null}
          </div>
        )}
      </section>
    </main>
  );
}
