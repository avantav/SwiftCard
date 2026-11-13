import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { SEGMENT_COPY, SEGMENTS } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";
import { ACCESS_COPY, campaignAccess } from "@/lib/campaigns/access";
import { CAMPAIGN_LIMITS, parseSegments, type CampaignPreview } from "@/lib/campaigns/form";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nueva campaña · morrow" };

type NewCampaignProps = {
  searchParams: Promise<{ segments?: string | string[]; branch?: string; error?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewCampaignPage({ searchParams }: NewCampaignProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
  const access = await campaignAccess(context);
  const segments = parseSegments([params.segments]);
  const branchId = params.branch && UUID.test(params.branch) ? params.branch : null;

  const header = (
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb"><Link href="/admin/campaigns">Campañas</Link> / Nueva</p>
        <h1>Nueva campaña</h1>
        <p>Elige a quién escribir, revisa la audiencia y redacta el mensaje.</p>
      </div>
    </header>
  );

  if (access !== "ALLOWED") {
    const copy = ACCESS_COPY[access];
    return (
      <main className="enterprise-page">
        {header}
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </main>
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

  return (
    <main className="enterprise-page">
      {header}
      {params.error ? <p className="enterprise-alert is-error" role="alert">{params.error.slice(0, 200)}</p> : null}

      <section className="enterprise-data-panel" aria-labelledby="audience-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="audience-title">1. Audiencia</h2>
            <p>Solo se incluyen clientes que aceptaron recibir promociones y que no recibieron otra campaña en los últimos 7 días.</p>
          </div>
        </div>
        <form className="campaign-audience-form" method="get">
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
        </form>
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
      </section>

      {preview && reachable > 0 ? (
        <section className="enterprise-data-panel" aria-labelledby="content-title">
          <div className="enterprise-panel-header">
            <div>
              <h2 id="content-title">2. Mensaje</h2>
              <p>Sin cupones ni descuentos automáticos: escribe un mensaje claro y la acción que esperas del cliente.</p>
            </div>
          </div>
          <form action={createCampaign} className="campaign-content-form">
            {segments.map((segment) => <input key={segment} name="segments" type="hidden" value={segment} />)}
            {branchId ? <input name="branchId" type="hidden" value={branchId} /> : null}
            <label className="field">
              <span>Nombre interno</span>
              <input maxLength={CAMPAIGN_LIMITS.name} name="name" placeholder="Ej. Recuperar clientes noviembre" required />
            </label>

            <fieldset className="campaign-channel">
              <legend>Correo</legend>
              <label className="check-field">
                <input defaultChecked={preview.email > 0} disabled={preview.email === 0} name="sendEmail" type="checkbox" />
                <span>Enviar por correo a {preview.email} {preview.email === 1 ? "cliente" : "clientes"}</span>
              </label>
              <label className="field">
                <span>Asunto</span>
                <input maxLength={CAMPAIGN_LIMITS.subject} name="emailSubject" />
              </label>
              <label className="field">
                <span>Mensaje</span>
                <textarea maxLength={CAMPAIGN_LIMITS.body} name="emailBody" rows={6} />
                <small className="field-hint">Hasta 1,500 caracteres. Se agrega un saludo con el nombre del cliente, un botón a su tarjeta y un enlace para darse de baja.</small>
              </label>
            </fieldset>

            <fieldset className="campaign-channel">
              <legend>Wallet</legend>
              <label className="check-field">
                <input defaultChecked={preview.wallet > 0} disabled={preview.wallet === 0} name="sendWallet" type="checkbox" />
                <span>Enviar aviso a {preview.wallet} {preview.wallet === 1 ? "cliente" : "clientes"} con la tarjeta en Apple Wallet o Google Wallet</span>
              </label>
              <label className="field">
                <span>Aviso</span>
                <input maxLength={CAMPAIGN_LIMITS.wallet} name="walletMessage" placeholder="Ej. Te extrañamos. Esta semana tu café te espera." />
                <small className="field-hint">Hasta 120 caracteres, sin enlaces. Aparece en la pantalla bloqueada: no incluyas datos personales.</small>
              </label>
            </fieldset>

            <label className="check-field">
              <input name="confirmSend" required type="checkbox" />
              <span>Confirmo el envío: hasta {preview.email} {preview.email === 1 ? "correo" : "correos"} y {preview.wallet} {preview.wallet === 1 ? "aviso" : "avisos"} en Wallet. Una vez enviada, la campaña no se puede cancelar.</span>
            </label>
            <SubmitButton className="primary-button">Enviar campaña</SubmitButton>
          </form>
        </section>
      ) : preview ? (
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">○</span>
          <h2>Nadie disponible en esta audiencia</h2>
          <p>Prueba con otros segmentos. Recuerda que solo se incluyen clientes que aceptaron promociones y que no recibieron otra campaña en los últimos 7 días.</p>
        </div>
      ) : null}
    </main>
  );
}
