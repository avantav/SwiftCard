import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { getModuleEntry, switchesOf } from "@/lib/modules/catalog";
import {
  GLOBAL_MODE_COPY,
  SWITCH_MODE_COPY,
  TENANT_CHOICE_COPY,
  effectiveGlobalMode,
  explainTenantModule,
  formatModuleDate,
  type GlobalMode,
  type OverrideState
} from "@/lib/modules/state";
import { setModuleGlobalMode, setTenantModuleState } from "../actions";

type PageProps = {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

type TenantRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  included_in_plan: boolean;
  override_state: OverrideState | null;
  override_expires_at: string | null;
  override_reason: string | null;
  active: boolean;
};

type StateRow = { mode: GlobalMode; reason: string; updated_at: string };
type AuditRow = { created_at: string; action: string; tenant_id: string | null; actor_staff_id: string | null; metadata: Record<string, unknown> };

const AUDIT_ACTIONS = ["MODULE_GLOBAL_UPDATED", "TENANT_MODULE_UPDATED"];
const STATE_LABEL: Record<string, string> = { OFF: "Apagado", BETA: "Beta", ON: "Disponible", INHERIT: "Según su paquete", GRANTED: "Otorgado", REVOKED: "Revocado" };

export default async function ModuleDetailPage({ params, searchParams }: PageProps) {
  const { moduleKey } = await params;
  const query = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const entry = getModuleEntry(moduleKey);
  if (!entry) notFound();
  const parent = entry.parent ? getModuleEntry(entry.parent) : undefined;
  const returnTo = `/superadmin/modules/${entry.key}`;

  const [stateResponse, tenantsResponse, parentResponse, auditResponse] = await Promise.all([
    context.supabase.from("module_states").select("mode,reason,updated_at").eq("module_key", entry.key).maybeSingle(),
    context.supabase.schema("app").rpc("get_module_tenants", { target_key: entry.key }),
    parent ? context.supabase.schema("app").rpc("get_module_tenants", { target_key: parent.key }) : Promise.resolve({ data: [], error: null }),
    context.supabase.from("audit_logs")
      .select("created_at,action,tenant_id,actor_staff_id,metadata")
      .in("action", AUDIT_ACTIONS)
      .eq("metadata->>module", entry.key)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);
  const state = stateResponse.data as StateRow | null;
  const tenants = (tenantsResponse.data ?? []) as TenantRow[];
  const parentActive = new Map(((parentResponse.data ?? []) as TenantRow[]).map((row) => [row.tenant_id, row.active]));
  const audit = (auditResponse.data ?? []) as AuditRow[];
  const failed = Boolean(stateResponse.error || tenantsResponse.error || parentResponse.error);
  const tenantNames = new Map(tenants.map((tenant) => [tenant.tenant_id, tenant.tenant_name]));
  const actorIds = [...new Set(audit.map((row) => row.actor_staff_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await context.supabase.from("staff_profiles").select("id,email").in("id", actorIds)
    : { data: [] as { id: string; email: string }[] };
  const actorEmails = new Map((actors ?? []).map((actor) => [actor.id, actor.email]));

  const mode = effectiveGlobalMode(entry.kind, state?.mode ?? null);
  const copy = entry.kind === "SWITCH" ? SWITCH_MODE_COPY[mode === "OFF" ? "OFF" : "ON"] : GLOBAL_MODE_COPY[mode];
  const modeOptions: GlobalMode[] = entry.kind === "SWITCH" ? ["ON", "OFF"] : ["OFF", "BETA", "ON"];
  const choiceOptions = entry.kind === "SWITCH" ? (["INHERIT", "REVOKED"] as const) : (["INHERIT", "GRANTED", "REVOKED"] as const);
  const activeCount = tenants.filter((tenant) => tenant.active).length;
  const switches = switchesOf(entry.key);

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Sistema · Módulos{parent ? ` · ${parent.name}` : ""}</p>
          <h1>{entry.name}</h1>
          <p>{entry.description}</p>
        </div>
        <Link className="enterprise-secondary-action" href={parent ? `/superadmin/modules/${parent.key}` : "/superadmin/modules"}>
          {parent ? `Volver a ${parent.name}` : "Volver a módulos"}
        </Link>
      </header>

      {query.saved ? <p className="enterprise-alert is-success" role="status"><strong>Cambio guardado.</strong> Se aplica en un máximo de 30 segundos.</p> : null}
      {query.error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {query.error}</p> : null}
      {entry.availability === "IN_DEVELOPMENT" ? <p className="enterprise-alert is-info" role="status"><strong>En desarrollo.</strong> Puedes preparar su configuración; no tiene efecto hasta que la función se publique.</p> : null}
      {failed ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo cargar el estado del módulo.</strong> Actualiza la página. Si continúa, verifica que la migración 0080 esté aplicada.</p> : null}

      <section className="enterprise-content-card" aria-labelledby="global-title">
        <h2 id="global-title">Estado global</h2>
        <p>
          <span className={`enterprise-badge ${copy.badge}`}>{copy.label}</span> {copy.help}
          {state ? <><br /><small>Último cambio: {formatModuleDate(state.updated_at)} · {state.reason}</small></> : null}
        </p>
        <p><small>Si está inactivo: {entry.inactiveEffect}</small></p>
        <form action={setModuleGlobalMode} className="auth-form">
          <input type="hidden" name="moduleKey" value={entry.key} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="field">
            <span>Estado global</span>
            <select name="mode" defaultValue={mode}>
              {modeOptions.map((option) => (
                <option key={option} value={option}>
                  {entry.kind === "SWITCH" ? SWITCH_MODE_COPY[option === "OFF" ? "OFF" : "ON"].label : GLOBAL_MODE_COPY[option].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Motivo</span>
            <textarea name="reason" required minLength={3} maxLength={500} />
          </label>
          <SubmitButton className="primary-button">Guardar estado global</SubmitButton>
        </form>
      </section>

      {mode !== "OFF" ? (
        <section className="enterprise-content-card" aria-labelledby="emergency-title">
          <h2 id="emergency-title">Apagado de emergencia</h2>
          <p>Desactiva {entry.name.toLowerCase()} para todos los tenants de inmediato, aunque lo paguen. {entry.inactiveEffect}</p>
          <form action={setModuleGlobalMode} className="auth-form">
            <input type="hidden" name="moduleKey" value={entry.key} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="mode" value="OFF" />
            <label className="field">
              <span>Motivo del apagado</span>
              <textarea name="reason" required minLength={3} maxLength={500} />
            </label>
            <SubmitButton className="danger-button" confirmMessage={`¿Apagar ${entry.name} para todos los tenants?`}>Apagar para todos</SubmitButton>
          </form>
        </section>
      ) : null}

      {switches.length > 0 ? (
        <section className="enterprise-data-panel" aria-labelledby="switches-title">
          <div className="enterprise-panel-header">
            <div>
              <h2 id="switches-title">Partes del módulo</h2>
              <p>Detén una parte sin apagar todo el módulo.</p>
            </div>
          </div>
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Partes de {entry.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Parte</th>
                  <th scope="col">Si se detiene</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {switches.map((item) => (
                  <tr key={item.key}>
                    <td data-label="Parte"><strong>{item.name}</strong><br /><small>{item.description}</small></td>
                    <td data-label="Si se detiene">{item.inactiveEffect}</td>
                    <td className="enterprise-row-actions"><Link className="enterprise-secondary-action" href={`/superadmin/modules/${item.key}`}>Administrar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="enterprise-content-card" aria-labelledby="tenant-adjust-title">
        <h2 id="tenant-adjust-title">Ajustar un tenant</h2>
        <p>{entry.kind === "SWITCH" ? "Revoca esta parte para un tenant o devuélvela a su estado normal." : "Otorga el módulo aunque su paquete no lo incluya, o revócalo aunque lo pague."}</p>
        {tenants.length === 0 ? <p>No hay tenants registrados.</p> : (
          <form action={setTenantModuleState} className="auth-form">
            <input type="hidden" name="moduleKey" value={entry.key} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="field">
              <span>Tenant</span>
              <select name="tenantId" required defaultValue="">
                <option value="" disabled>Selecciona un tenant</option>
                {tenants.map((tenant) => <option key={tenant.tenant_id} value={tenant.tenant_id}>{tenant.tenant_name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Ajuste</span>
              <select name="state" defaultValue="INHERIT">
                {choiceOptions.map((option) => <option key={option} value={option}>{TENANT_CHOICE_COPY[option]}</option>)}
              </select>
            </label>
            {entry.kind === "MODULE" ? (
              <label className="field">
                <span>Vence (opcional, solo para otorgamientos)</span>
                <input name="expiresOn" type="date" />
              </label>
            ) : null}
            <label className="field">
              <span>Motivo</span>
              <textarea name="reason" required minLength={3} maxLength={500} />
            </label>
            <SubmitButton className="primary-button">Guardar ajuste</SubmitButton>
          </form>
        )}
      </section>

      <section className="enterprise-data-panel" aria-labelledby="tenants-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="tenants-title">Tenants</h2>
            <p>{failed ? "La información no está disponible." : `${activeCount} de ${tenants.length} con ${entry.kind === "SWITCH" ? "esta parte" : "el módulo"} activo`}</p>
          </div>
        </div>
        {tenants.length === 0 ? (
          <div className="enterprise-empty-state"><h3>No hay tenants</h3><p>Cuando registres un tenant aparecerá aquí con su estado.</p></div>
        ) : (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Estado del módulo por tenant</caption>
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Motivo del estado</th>
                  <th scope="col">Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.tenant_id}>
                    <td data-label="Tenant">
                      <Link href={`/superadmin/tenants/${tenant.tenant_id}/modules`}><strong>{tenant.tenant_name}</strong></Link>
                      {tenant.tenant_status !== "ACTIVE" ? <><br /><small>Tenant suspendido</small></> : null}
                    </td>
                    <td data-label="Estado"><span className={`enterprise-badge ${tenant.active ? "is-active" : "is-neutral"}`}>{tenant.active ? "Activo" : "Inactivo"}</span></td>
                    <td data-label="Motivo del estado">
                      {explainTenantModule({
                        kind: entry.kind,
                        globalMode: state?.mode ?? null,
                        overrideState: tenant.override_state,
                        overrideExpiresAt: tenant.override_expires_at,
                        includedInPlan: tenant.included_in_plan,
                        active: tenant.active,
                        parentActive: parent ? parentActive.get(tenant.tenant_id) ?? false : undefined
                      })}
                    </td>
                    <td data-label="Ajuste">
                      {TENANT_CHOICE_COPY[tenant.override_state ?? "INHERIT"]}
                      {tenant.override_state === "GRANTED" ? <><br /><small>Vence: {formatModuleDate(tenant.override_expires_at)}</small></> : null}
                      {tenant.override_reason ? <><br /><small>{tenant.override_reason}</small></> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="enterprise-data-panel" aria-labelledby="history-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="history-title">Historial</h2>
            <p>Últimos 20 cambios.</p>
          </div>
        </div>
        {auditResponse.error ? (
          <div className="enterprise-empty-state is-error" role="alert"><h3>No se pudo cargar el historial</h3><p>Actualiza la página para intentarlo de nuevo.</p></div>
        ) : audit.length === 0 ? (
          <div className="enterprise-empty-state"><h3>Sin cambios</h3><p>Los cambios de estado global y por tenant aparecerán aquí con su motivo.</p></div>
        ) : (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Historial de cambios del módulo</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Cambio</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Por</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row, index) => {
                  const from = STATE_LABEL[String(row.metadata.from ?? (row.action === "MODULE_GLOBAL_UPDATED" ? "OFF" : "INHERIT"))] ?? "—";
                  const to = STATE_LABEL[String(row.metadata.to)] ?? "—";
                  const scope = row.tenant_id ? tenantNames.get(row.tenant_id) ?? "Tenant" : "Global";
                  return (
                    <tr key={`${row.created_at}-${index}`}>
                      <td data-label="Fecha">{formatModuleDate(row.created_at)}</td>
                      <td data-label="Cambio">{scope}: {from} → {to}</td>
                      <td data-label="Motivo">{String(row.metadata.reason ?? "")}</td>
                      <td data-label="Por">{row.actor_staff_id ? actorEmails.get(row.actor_staff_id) ?? "Superadmin" : "Sistema"}</td>
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
