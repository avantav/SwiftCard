import type { Metadata } from "next";
import Link from "next/link";
import { SEGMENT_COPY, isSegment } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";
import { ACCESS_COPY, campaignAccess, canReadCampaigns } from "@/lib/campaigns/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Campañas · morrow" };

type CampaignRow = {
  id: string;
  name: string;
  segments: string[];
  send_email: boolean;
  send_wallet: boolean;
  status: "SENDING" | "SENT";
  recipient_count: number;
  created_at: string;
};

export default async function CampaignsPage() {
  const context = await requireInternalArea("ADMIN");
  const access = await campaignAccess(context);

  const header = (allowed: boolean) => (
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb">Operación</p>
        <h1>Campañas</h1>
        <p>Envía mensajes por correo y Wallet a segmentos de clientes que aceptaron recibir promociones.</p>
      </div>
      {allowed ? <Link className="primary-button" href="/admin/campaigns/nueva">Nueva campaña</Link> : null}
    </header>
  );

  if (!canReadCampaigns(access)) {
    const copy = ACCESS_COPY[access];
    return (
      <main className="enterprise-page">
        {header(false)}
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </main>
    );
  }

  const [campaignsResult, tenantResult] = await Promise.all([
    context.supabase
      .from("marketing_campaigns")
      .select("id,name,segments,send_email,send_wallet,status,recipient_count,created_at")
      .eq("tenant_id", context.tenantId ?? "")
      .order("created_at", { ascending: false })
      .limit(50),
    context.tenantId ? context.supabase.from("tenants").select("timezone").eq("id", context.tenantId).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  const campaigns = (campaignsResult.data ?? []) as CampaignRow[];
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: tenantResult.data?.timezone ?? "America/Mazatlan" });

  return (
    <main className="enterprise-page">
      {header(access === "ALLOWED")}
      {access === "SUPPORT_READ" ? <p className="enterprise-alert is-info" role="status">{ACCESS_COPY.SUPPORT_READ.body}</p> : null}
      <section className="enterprise-data-panel" aria-labelledby="campaigns-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="campaigns-title">Historial</h2>
            <p>Cada cliente recibe como máximo una campaña cada 7 días, sumando correo y Wallet.</p>
          </div>
        </div>
        {campaignsResult.error ? (
          <div className="enterprise-empty-state is-error" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudieron cargar las campañas</h3>
            <p>Actualiza la página para volver a intentarlo.</p>
          </div>
        ) : campaigns.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Campañas enviadas</caption>
              <thead>
                <tr>
                  <th scope="col">Campaña</th>
                  <th scope="col">Segmentos</th>
                  <th scope="col">Canales</th>
                  <th scope="col" className="enterprise-number">Envíos</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td data-label="Campaña"><Link href={`/admin/campaigns/${campaign.id}`}>{campaign.name}</Link></td>
                    <td data-label="Segmentos">{campaign.segments.filter(isSegment).map((segment) => SEGMENT_COPY[segment].label).join(", ")}</td>
                    <td data-label="Canales">{[campaign.send_email ? "Correo" : null, campaign.send_wallet ? "Wallet" : null].filter(Boolean).join(" y ")}</td>
                    <td data-label="Envíos" className="enterprise-number">{campaign.recipient_count}</td>
                    <td data-label="Estado"><span className={`enterprise-badge ${campaign.status === "SENT" ? "is-active" : "is-suspended"}`}>{campaign.status === "SENT" ? "Enviada" : "Enviando"}</span></td>
                    <td data-label="Fecha">{date.format(new Date(campaign.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="enterprise-empty-state" role="status">
            <span className="enterprise-empty-icon" aria-hidden="true">○</span>
            <h3>Aún no has enviado campañas</h3>
            <p>Empieza por los clientes en riesgo o los perdidos: son los que más rápido puedes recuperar.</p>
            {access === "ALLOWED" ? <Link className="enterprise-secondary-action" href="/admin/campaigns/nueva?segments=AT_RISK&segments=LOST">Empezar con clientes en riesgo y perdidos</Link> : null}
          </div>
        )}
      </section>
    </main>
  );
}
