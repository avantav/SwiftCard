import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSegment, SEGMENT_COPY } from "@/lib/admin/insights";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clientes por segmento · morrow"
};

type SegmentPageProps = {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ branch?: string }>;
};

type Member = {
  customer_id: string;
  full_name: string;
  normalized_phone: string;
  email: string | null;
  purchase_count: number;
  last_purchase_at: string | null;
  spend_minor: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SegmentMembersPage({ params, searchParams }: SegmentPageProps) {
  const context = await requireInternalArea("ADMIN");
  const { segment: rawSegment } = await params;
  const { branch } = await searchParams;
  const segment = rawSegment.toUpperCase();
  if (!isSegment(segment)) notFound();
  const copy = SEGMENT_COPY[segment];
  const backHref = `/admin/dashboard${branch && UUID.test(branch) ? `?branch=${branch}` : ""}`;

  const header = (
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb"><Link href={backHref}>Estadísticas</Link> / Segmentos</p>
        <h1>{copy.label}</h1>
        <p>{copy.rule} {copy.action}</p>
      </div>
    </header>
  );

  if (context.access.role !== "ADMIN" || context.supportSession) {
    return (
      <main className="enterprise-page">
        {header}
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>Lista disponible solo para el Admin general</h2>
          <p>Las listas de clientes forman parte del directorio administrativo del negocio.</p>
        </div>
      </main>
    );
  }

  const [membersResult, tenantResult] = await Promise.all([
    context.supabase.schema("app").rpc("get_customer_segment_members", {
      target_segment: segment,
      target_branch_id: branch && UUID.test(branch) ? branch : null
    }),
    context.tenantId
      ? context.supabase.from("tenants").select("timezone,currency_code").eq("id", context.tenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  const members = (membersResult.data ?? []) as Member[];
  const timeZone = tenantResult.data?.timezone ?? "America/Mazatlan";
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone });
  const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: tenantResult.data?.currency_code ?? "MXN", maximumFractionDigits: 0 });

  return (
    <main className="enterprise-page">
      {header}
      <section className="enterprise-data-panel" aria-labelledby="segment-members-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="segment-members-title">Clientes del segmento</h2>
            <p>{members.length >= 500 ? "Mostrando los 500 con más gasto" : `${members.length} ${members.length === 1 ? "cliente" : "clientes"} hoy`}</p>
          </div>
        </div>
        {membersResult.error ? (
          <div className="enterprise-empty-state is-error" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudo cargar la lista</h3>
            <p>Actualiza la página para volver a intentarlo.</p>
          </div>
        ) : members.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Clientes del segmento {copy.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Contacto</th>
                  <th scope="col" className="enterprise-number">Compras</th>
                  <th scope="col">Última compra</th>
                  <th scope="col" className="enterprise-number">Gasto total</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.customer_id}>
                    <td data-label="Cliente">{member.full_name}</td>
                    <td data-label="Contacto">{member.normalized_phone}{member.email ? <><br /><small>{member.email}</small></> : null}</td>
                    <td data-label="Compras" className="enterprise-number">{member.purchase_count}</td>
                    <td data-label="Última compra">{member.last_purchase_at ? date.format(new Date(member.last_purchase_at)) : "—"}</td>
                    <td data-label="Gasto total" className="enterprise-number">{money.format(Number(member.spend_minor) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="enterprise-empty-state" role="status">
            <span className="enterprise-empty-icon" aria-hidden="true">○</span>
            <h3>Nadie en este segmento hoy</h3>
            <p>Los segmentos se recalculan con cada compra.</p>
            <Link className="enterprise-secondary-action" href={backHref}>Volver a estadísticas</Link>
          </div>
        )}
      </section>
    </main>
  );
}
