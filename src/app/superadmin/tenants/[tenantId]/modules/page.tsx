import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { catalogInDisplayOrder, catalogKeys } from "@/lib/modules/catalog";
import {
  TENANT_CHOICE_COPY,
  explainTenantModule,
  formatModuleDate,
  type GlobalMode,
  type OverrideState
} from "@/lib/modules/state";
import { setTenantModuleState } from "@/app/superadmin/modules/actions";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

type TenantModuleRow = {
  module_key: string;
  global_mode: GlobalMode | null;
  override_state: OverrideState | null;
  override_expires_at: string | null;
  override_reason: string | null;
  included_in_plan: boolean;
  active: boolean;
};

export default async function TenantModulesPage({ params, searchParams }: PageProps) {
  const { tenantId } = await params;
  const query = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) notFound();
  const [tenantResponse, modulesResponse] = await Promise.all([
    context.supabase.from("tenants").select("id,name,status").eq("id", tenantId).maybeSingle(),
    context.supabase.schema("app").rpc("get_tenant_modules", { target_tenant_id: tenantId, target_keys: catalogKeys() })
  ]);
  const tenant = tenantResponse.data;
  if (!tenant) notFound();
  const rows = new Map(((modulesResponse.data ?? []) as TenantModuleRow[]).map((row) => [row.module_key, row]));
  const entries = catalogInDisplayOrder();
  const failed = Boolean(modulesResponse.error);
  const returnTo = `/superadmin/tenants/${tenant.id}/modules`;

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Tenants · Módulos</p>
          <h1>{tenant.name}</h1>
          <p>Módulos activos según su paquete y los ajustes del Superadmin.</p>
        </div>
        <Link className="enterprise-secondary-action" href="/superadmin">Volver a tenants</Link>
      </header>

      {query.saved ? <p className="enterprise-alert is-success" role="status"><strong>Ajuste guardado.</strong> Se aplica en un máximo de 30 segundos.</p> : null}
      {query.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {query.error}</p> : null}

      <section className="enterprise-content-card" aria-labelledby="tenant-module-adjust-title">
        <h2 id="tenant-module-adjust-title">Ajustar un módulo</h2>
        <p>Otorga un módulo aunque su paquete no lo incluya, o revócalo aunque lo pague. Las partes de un módulo solo se pueden revocar.</p>
        <form action={setTenantModuleState} className="auth-form">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="field">
            <span>Módulo</span>
            <select name="moduleKey" required defaultValue="">
              <option value="" disabled>Selecciona un módulo</option>
              {entries.map((entry) => <option key={entry.key} value={entry.key}>{entry.kind === "SWITCH" ? `— ${entry.name}` : entry.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Ajuste</span>
            <select name="state" defaultValue="INHERIT">
              {(["INHERIT", "GRANTED", "REVOKED"] as const).map((option) => <option key={option} value={option}>{TENANT_CHOICE_COPY[option]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Vence (opcional, solo para otorgamientos)</span>
            <input name="expiresOn" type="date" />
          </label>
          <label className="field">
            <span>Motivo</span>
            <textarea name="reason" required minLength={3} maxLength={500} />
          </label>
          <SubmitButton className="primary-button">Guardar ajuste</SubmitButton>
        </form>
      </section>

      <section className="enterprise-data-panel" aria-labelledby="tenant-modules-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="tenant-modules-title">Módulos del tenant</h2>
            <p>{failed ? "La información no está disponible." : `${[...rows.values()].filter((row) => row.active).length} activos de ${entries.length}`}</p>
          </div>
        </div>
        {failed ? (
          <div className="enterprise-empty-state is-error" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudieron cargar los módulos</h3>
            <p>Actualiza la página. Si continúa, verifica que la migración 0080 esté aplicada.</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="enterprise-empty-state"><h3>Aún no hay módulos</h3><p>Los módulos se declaran en el catálogo del código.</p></div>
        ) : (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Módulos de {tenant.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Motivo del estado</th>
                  <th scope="col">Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const row = rows.get(entry.key);
                  const parentRow = entry.parent ? rows.get(entry.parent) : undefined;
                  const active = row?.active ?? false;
                  const state = row?.override_state ?? null;
                  return (
                    <tr key={entry.key}>
                      <td data-label="Módulo">
                        <Link href={`/superadmin/modules/${entry.key}`}><strong>{entry.name}</strong></Link>
                        <br />
                        <small>{entry.kind === "SWITCH" ? "Parte de un módulo" : entry.key}{entry.availability === "IN_DEVELOPMENT" ? " · En desarrollo" : ""}</small>
                      </td>
                      <td data-label="Estado"><span className={`enterprise-badge ${active ? "is-active" : "is-neutral"}`}>{active ? "Activo" : "Inactivo"}</span></td>
                      <td data-label="Motivo del estado">
                        {explainTenantModule({
                          kind: entry.kind,
                          globalMode: row?.global_mode ?? null,
                          overrideState: state,
                          overrideExpiresAt: row?.override_expires_at ?? null,
                          includedInPlan: row?.included_in_plan ?? false,
                          active,
                          parentActive: entry.parent ? parentRow?.active ?? false : undefined
                        })}
                      </td>
                      <td data-label="Ajuste">
                        {TENANT_CHOICE_COPY[state ?? "INHERIT"]}
                        {state === "GRANTED" ? <><br /><small>Vence: {formatModuleDate(row?.override_expires_at ?? null)}</small></> : null}
                        {row?.override_reason ? <><br /><small>{row.override_reason}</small></> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
