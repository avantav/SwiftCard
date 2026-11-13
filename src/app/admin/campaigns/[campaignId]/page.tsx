import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { isSegment, SEGMENT_COPY } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";
import { ACCESS_COPY, campaignAccess } from "@/lib/campaigns/access";
import { retryCampaign } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Campaña · morrow" };

type DetailProps = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ created?: string; retried?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = [
  { key: "EMAIL", label: "Correo" },
  { key: "APPLE", label: "Apple Wallet" },
  { key: "GOOGLE", label: "Google Wallet" }
] as const;
const STATUSES = [
  { key: "SENT", label: "Enviados" },
  { key: "PENDING", label: "Pendientes" },
  { key: "FAILED", label: "Fallidos" },
  { key: "SKIPPED", label: "Omitidos" }
] as const;

export default async function CampaignDetailPage({ params, searchParams }: DetailProps) {
  const context = await requireInternalArea("ADMIN");
  const { campaignId } = await params;
  const query = await searchParams;
  if (!UUID.test(campaignId)) notFound();
  const access = await campaignAccess(context);
  if (access !== "ALLOWED") {
    const copy = ACCESS_COPY[access];
    return (
      <main className="enterprise-page">
        <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb"><Link href="/admin/campaigns">Campañas</Link></p><h1>Campaña</h1></div></header>
        <div className="enterprise-empty-state" role="status"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h2>{copy.title}</h2><p>{copy.body}</p></div>
      </main>
    );
  }

  const [campaignResult, recipientsResult] = await Promise.all([
    context.supabase
      .from("marketing_campaigns")
      .select("id,name,segments,send_email,email_subject,email_body,send_wallet,wallet_message,status,recipient_count,created_at,completed_at")
      .eq("id", campaignId)
      .maybeSingle(),
    context.supabase.from("marketing_campaign_recipients").select("channel,status").eq("campaign_id", campaignId).limit(20000)
  ]);
  const campaign = campaignResult.data;
  if (!campaign) notFound();
  const recipients = recipientsResult.data ?? [];
  const count = (channel: string, status: string) => recipients.filter((row) => row.channel === channel && row.status === status).length;
  const retryable = recipients.some((row) => row.status === "PENDING" || row.status === "FAILED");
  const retry = retryCampaign.bind(null, campaign.id);

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb"><Link href="/admin/campaigns">Campañas</Link> / Detalle</p>
          <h1>{campaign.name}</h1>
          <p>{campaign.segments.filter(isSegment).map((segment: string) => SEGMENT_COPY[segment as keyof typeof SEGMENT_COPY].label).join(", ")} · {campaign.recipient_count} envíos</p>
        </div>
        {retryable ? (
          <form action={retry}>
            <SubmitButton className="enterprise-secondary-action">Reintentar pendientes</SubmitButton>
          </form>
        ) : null}
      </header>

      {query.created ? <p className="enterprise-alert is-success" role="status">Campaña creada. El envío continúa en segundo plano; actualiza la página para ver el avance.</p> : null}
      {query.retried ? <p className="enterprise-alert is-success" role="status">Reintentando los envíos pendientes.</p> : null}

      <section className="enterprise-data-panel" aria-labelledby="delivery-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="delivery-title">Entrega por canal</h2>
            <p>{campaign.status === "SENT" ? "Envío terminado." : "Envío en curso."} Los omitidos retiraron su consentimiento o ya no tienen correo o tarjeta.</p>
          </div>
          <span className={`enterprise-badge ${campaign.status === "SENT" ? "is-active" : "is-suspended"}`}>{campaign.status === "SENT" ? "Enviada" : "Enviando"}</span>
        </div>
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <caption className="sr-only">Estado de entrega por canal</caption>
            <thead>
              <tr><th scope="col">Canal</th>{STATUSES.map((status) => <th className="enterprise-number" key={status.key} scope="col">{status.label}</th>)}</tr>
            </thead>
            <tbody>
              {CHANNELS.map((channel) => (
                <tr key={channel.key}>
                  <td data-label="Canal">{channel.label}</td>
                  {STATUSES.map((status) => <td className="enterprise-number" data-label={status.label} key={status.key}>{count(channel.key, status.key)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="enterprise-data-panel" aria-labelledby="message-title">
        <div className="enterprise-panel-header"><div><h2 id="message-title">Mensaje enviado</h2></div></div>
        <dl className="campaign-message">
          {campaign.send_email ? (
            <>
              <div><dt>Asunto del correo</dt><dd>{campaign.email_subject}</dd></div>
              <div><dt>Mensaje del correo</dt><dd className="campaign-body">{campaign.email_body}</dd></div>
            </>
          ) : null}
          {campaign.send_wallet ? <div><dt>Aviso en Wallet</dt><dd>{campaign.wallet_message}</dd></div> : null}
        </dl>
      </section>
    </main>
  );
}
