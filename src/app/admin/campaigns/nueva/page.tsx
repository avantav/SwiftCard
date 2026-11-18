import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { AdminMasterDetail, AdminScrollRegion, AdminWorkspace } from "@/components/admin/admin-workspace";
import { CampaignContentForm } from "@/components/campaign-content-form";
import { SEGMENT_COPY, SEGMENTS } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";
import { ACCESS_COPY, campaignAccess } from "@/lib/campaigns/access";
import { parseSegments, type CampaignPreview } from "@/lib/campaigns/form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nueva campaña · morrow" };

type NewCampaignProps = {
  searchParams: Promise<{ segments?: string | string[]; branch?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * New campaign workspace (DEC-0073): audience on the left (recalculated with
 * soft navigation), message on the right in its own scroll region. Errors
 * keep the typed message; the audience stays in the URL.
 */
export default async function NewCampaignPage({ searchParams }: NewCampaignProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const access = await campaignAccess(context);
  const segments = parseSegments([params.segments]);
  const branchId = params.branch && UUID.test(params.branch) ? params.branch : null;
  const breadcrumb = <><Link href="/admin/campaigns">Campañas</Link> / Nueva</>;

  if (access !== "ALLOWED") {
    const copy = ACCESS_COPY[access];
    return (
      <AdminWorkspace breadcrumb={breadcrumb} description="Elige a quién escribir, revisa la audiencia y redacta el mensaje." title="Nueva campaña">
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </AdminWorkspace>
    );
  }

  const [branchesResult, previewResult] = await Promise.all([
    context.supabase.from("branches").select("id,name").eq("tenant_id", context.tenantId ?? "").eq("status", "ACTIVE").order("name"),
    segments.length
      ? context.supabase.schema("app").rpc("preview_marketing_campaign", { target_segments: segments, target_branch_id: branchId })
      : Promise.resolve({ data: null, error: null })
  ]);
  const preview = previewResult.data as CampaignPreview | null;
  const reachable = preview ? Math.max(preview.email, preview.wallet) : 0;

  const audience = (
    <section className="enterprise-data-panel campaign-audience-panel" aria-labelledby="audience-title">
      <div className="enterprise-panel-header">
        <div>
          <h2 id="audience-title">1. Audiencia</h2>
          <p>Solo se incluyen clientes que aceptaron recibir promociones y que no recibieron otra campaña en los últimos 7 días.</p>
        </div>
      </div>
      <AdminScrollRegion label="Audiencia de la campaña">
        <Form action="/admin/campaigns/nueva" className="campaign-audience-form" scroll={false}>
          <fieldset className="campaign-segments">
            <legend>Segmentos</legend>
            {SEGMENTS.map((segment) => (
              <label className="check-field" key={segment}>
                <input defaultChecked={segments.includes(segment)} name="segments" type="checkbox" value={segment} />
                <span><strong>{SEGMENT_COPY[segment].label}</strong><small>{SEGMENT_COPY[segment].rule}</small></span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Sucursal</span>
            <select defaultValue={branchId ?? ""} name="branch">
              <option value="">Todas las sucursales</option>
              {(branchesResult.data ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <button className="enterprise-secondary-action" type="submit">Calcular audiencia</button>
        </Form>
        {previewResult.error ? (
          <p className="enterprise-alert is-error campaign-inset" role="alert">No se pudo calcular la audiencia. Intenta de nuevo.</p>
        ) : preview ? (
          <dl className="insights-stats campaign-preview" aria-live="polite">
            <div><dt>Clientes en los segmentos</dt><dd>{preview.customers}</dd></div>
            <div><dt>Recibirán correo</dt><dd>{preview.email}</dd></div>
            <div><dt>Recibirán aviso en Wallet</dt><dd>{preview.wallet}</dd></div>
            <div><dt>Excluidos</dt><dd>{preview.without_consent + preview.capped}</dd><small>{preview.without_consent} sin consentimiento · {preview.capped} por el límite de 7 días</small></div>
          </dl>
        ) : <p className="field-hint campaign-inset">Elige uno o más segmentos y calcula la audiencia.</p>}
      </AdminScrollRegion>
    </section>
  );

  const message = preview && reachable > 0 ? (
    <section className="enterprise-data-panel" aria-labelledby="content-title">
      <div className="enterprise-panel-header">
        <div>
          <h2 id="content-title">2. Mensaje</h2>
          <p>Sin cupones ni descuentos automáticos: escribe un mensaje claro y la acción que esperas del cliente.</p>
        </div>
      </div>
      <AdminScrollRegion label="Mensaje de la campaña">
        <CampaignContentForm branchId={branchId} email={preview.email} key={`${segments.join(",")}|${branchId ?? ""}`} segments={segments} wallet={preview.wallet} />
      </AdminScrollRegion>
    </section>
  ) : (
    <div className="enterprise-empty-state" role="status">
      <span className="enterprise-empty-icon" aria-hidden="true">○</span>
      <h2>{preview ? "Nadie disponible en esta audiencia" : "Primero calcula la audiencia"}</h2>
      <p>{preview ? "Prueba con otros segmentos. Recuerda que solo se incluyen clientes que aceptaron promociones y que no recibieron otra campaña en los últimos 7 días." : "Cuando elijas a quién escribir, aquí redactarás el correo y el aviso de Wallet."}</p>
    </div>
  );

  return (
    <AdminWorkspace breadcrumb={breadcrumb} className="campaign-workspace" description="Elige a quién escribir, revisa la audiencia y redacta el mensaje." title="Nueva campaña">
      <AdminMasterDetail className="campaign-split" detail={message} master={audience} />
    </AdminWorkspace>
  );
}
