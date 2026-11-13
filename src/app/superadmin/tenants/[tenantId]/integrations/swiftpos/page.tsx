import Link from "next/link";
import { notFound } from "next/navigation";
import { IntegrationKeyIssuer } from "@/components/integration-key-issuer";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { formatModuleDate } from "@/lib/modules/state";
import { issueIntegrationKey, revokeIntegrationKey, saveIntegrationBranchLink, saveIntegrationLimits } from "./actions";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

type Integration = {
  id: string;
  status: string;
  max_amount_minor: number;
  max_purchases_per_card_hour: number;
  max_purchases_per_card_day: number;
};
type IntegrationKey = { id: string; key_prefix: string; status: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type BranchLink = { external_store_id: string; branch_id: string };
type ModuleRow = { module_key: string; active: boolean };

const SAVED_COPY: Record<string, string> = {
  revoked: "Llave revocada. SwiftPOS deja de poder usarla de inmediato.",
  link: "Sucursal vinculada.",
  unlink: "Vínculo de sucursal eliminado.",
  limits: "Límites guardados."
};

function formatPesos(minor: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(minor / 100);
}

export default async function SwiftposIntegrationPage({ params, searchParams }: PageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { tenantId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) notFound();

  const [tenantResponse, integrationResponse, branchesResponse, moduleResponse] = await Promise.all([
    context.supabase.from("tenants").select("id,name").eq("id", tenantId).maybeSingle(),
    context.supabase.from("tenant_integrations")
      .select("id,status,max_amount_minor,max_purchases_per_card_hour,max_purchases_per_card_day")
      .eq("tenant_id", tenantId).eq("provider", "SWIFTPOS").maybeSingle(),
    context.supabase.from("branches").select("id,name,status").eq("tenant_id", tenantId).order("name"),
    context.supabase.schema("app").rpc("get_tenant_modules", { target_tenant_id: tenantId, target_keys: ["swiftpos_integration"] })
  ]);
  const tenant = tenantResponse.data;
  if (!tenant) notFound();
  const integration = integrationResponse.data as Integration | null;
  const branches = (branchesResponse.data ?? []) as { id: string; name: string; status: string }[];
  const moduleActive = ((moduleResponse.data ?? []) as ModuleRow[]).some((row) => row.active);

  const [keysResponse, linksResponse] = integration
    ? await Promise.all([
        context.supabase.from("integration_keys")
          .select("id,key_prefix,status,created_at,last_used_at,revoked_at")
          .eq("integration_id", integration.id).order("created_at", { ascending: false }),
        context.supabase.from("integration_branch_links")
          .select("external_store_id,branch_id")
          .eq("integration_id", integration.id).order("external_store_id")
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const keys = (keysResponse.data ?? []) as IntegrationKey[];
  const links = (linksResponse.data ?? []) as BranchLink[];
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const failed = Boolean(integrationResponse.error || branchesResponse.error || moduleResponse.error || keysResponse.error || linksResponse.error);
  const activeKeys = keys.filter((key) => key.status === "ACTIVE");

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Tenants · Integración SwiftPOS</p>
          <h1>{tenant.name}</h1>
          <p>Conecta SwiftPOS para que sus ventas acumulen en las tarjetas del negocio.</p>
        </div>
        <Link className="enterprise-secondary-action" href="/superadmin">Volver a tenants</Link>
      </header>

      {query.saved && SAVED_COPY[query.saved] ? <p className="enterprise-alert is-success" role="status">{SAVED_COPY[query.saved]}</p> : null}
      {query.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {query.error}</p> : null}
      {failed ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo cargar la integración.</strong> Actualiza la página. Si continúa, verifica que la migración 0081 esté aplicada.</p> : null}

      <section className="enterprise-content-card" aria-labelledby="integration-module-title">
        <h2 id="integration-module-title">Módulo</h2>
        <p>
          <span className={`enterprise-badge ${moduleActive ? "is-active" : "is-neutral"}`}>{moduleActive ? "Activo" : "Inactivo"}</span>{" "}
          {moduleActive
            ? "SwiftPOS puede identificar tarjetas y enviar compras para este tenant."
            : "Mientras el módulo esté inactivo, SwiftPOS recibe «MODULE_NOT_ACTIVE» y el negocio opera igual que hoy."}
        </p>
        <Link className="enterprise-secondary-action" href={`/superadmin/tenants/${tenant.id}/modules`}>Administrar módulos del tenant</Link>
      </section>

      <section className="enterprise-content-card" aria-labelledby="integration-keys-title">
        <h2 id="integration-keys-title">API keys</h2>
        <p>Se guardan solo como hash. Puede haber dos activas para rotar sin cortar el servicio: emite la nueva, configúrala en SwiftPOS y revoca la anterior.</p>
        {activeKeys.length < 2 ? <IntegrationKeyIssuer tenantId={tenant.id} action={issueIntegrationKey} /> : <p className="enterprise-alert is-info" role="status">Hay dos llaves activas. Revoca una para emitir otra.</p>}
        {keys.length > 0 ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">API keys de SwiftPOS</caption>
              <thead><tr><th scope="col">Prefijo</th><th scope="col">Estado</th><th scope="col">Emitida</th><th scope="col">Último uso</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td data-label="Prefijo"><code>{key.key_prefix}</code></td>
                    <td data-label="Estado"><span className={`enterprise-badge ${key.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{key.status === "ACTIVE" ? "Activa" : "Revocada"}</span></td>
                    <td data-label="Emitida">{formatModuleDate(key.created_at)}</td>
                    <td data-label="Último uso">{key.last_used_at ? formatModuleDate(key.last_used_at) : "Sin uso"}</td>
                    <td className="enterprise-row-actions">
                      {key.status === "ACTIVE" ? (
                        <form action={revokeIntegrationKey}>
                          <input type="hidden" name="tenantId" value={tenant.id} />
                          <input type="hidden" name="keyId" value={key.id} />
                          <input type="hidden" name="reason" value={`Revocación de la llave ${key.key_prefix}`} />
                          <SubmitButton className="danger-button" confirmMessage={`¿Revocar la llave ${key.key_prefix}? SwiftPOS dejará de poder usarla de inmediato.`}>Revocar</SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="enterprise-content-card" aria-labelledby="integration-branches-title">
        <h2 id="integration-branches-title">Sucursales vinculadas</h2>
        <p>Relaciona el ID de cada sucursal de SwiftPOS con su sucursal en SwiftCard. Las compras solo se aceptan de sucursales vinculadas.</p>
        {links.length > 0 ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Sucursales de SwiftPOS vinculadas</caption>
              <thead><tr><th scope="col">ID en SwiftPOS</th><th scope="col">Sucursal SwiftCard</th></tr></thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.external_store_id}>
                    <td data-label="ID en SwiftPOS"><code>{link.external_store_id}</code></td>
                    <td data-label="Sucursal SwiftCard">{branchNames.get(link.branch_id) ?? "Sucursal no disponible"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>Aún no hay sucursales vinculadas.</p>}
        {branches.length === 0 ? <p>El tenant no tiene sucursales. Créalas antes de vincular SwiftPOS.</p> : (
          <form action={saveIntegrationBranchLink} className="auth-form">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <label className="field">
              <span>ID de la sucursal en SwiftPOS</span>
              <input name="storeId" required maxLength={100} pattern="[A-Za-z0-9_.:\-]{1,100}" />
            </label>
            <label className="field">
              <span>Sucursal en SwiftCard</span>
              <select name="branchId" defaultValue="">
                <option value="">Quitar vínculo</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.status !== "ACTIVE" ? " (inactiva)" : ""}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Motivo</span>
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
            <SubmitButton className="enterprise-secondary-action">Guardar vínculo</SubmitButton>
          </form>
        )}
      </section>

      <section className="enterprise-content-card" aria-labelledby="integration-limits-title">
        <h2 id="integration-limits-title">Límites</h2>
        <p>
          Protegen contra compras falsas si una llave se filtra.
          {integration ? ` Actuales: ${formatPesos(integration.max_amount_minor)} por venta, ${integration.max_purchases_per_card_hour} compras por tarjeta por hora y ${integration.max_purchases_per_card_day} por día.` : " Valores iniciales: $20,000.00 por venta, 5 compras por tarjeta por hora y 20 por día."}
        </p>
        <form action={saveIntegrationLimits} className="auth-form">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <label className="field">
            <span>Monto máximo por venta (MXN)</span>
            <input name="maxAmount" inputMode="decimal" required defaultValue={((integration?.max_amount_minor ?? 2000000) / 100).toFixed(2)} />
          </label>
          <label className="field">
            <span>Compras por tarjeta por hora</span>
            <input name="maxPerHour" type="number" min={1} max={100} required defaultValue={integration?.max_purchases_per_card_hour ?? 5} />
          </label>
          <label className="field">
            <span>Compras por tarjeta por día</span>
            <input name="maxPerDay" type="number" min={1} max={500} required defaultValue={integration?.max_purchases_per_card_day ?? 20} />
          </label>
          <label className="field">
            <span>Motivo</span>
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
          <SubmitButton className="enterprise-secondary-action">Guardar límites</SubmitButton>
        </form>
      </section>
    </main>
  );
}
