import Link from "next/link";
import { redirect } from "next/navigation";
import { TenantLegalProfileForm } from "@/components/tenant-legal-profile-form";
import { requireInternalArea } from "@/lib/auth/server";

export default async function AdminLegalPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN") redirect("/admin");
  const query = await searchParams;
  const tenantId = context.tenantId ?? "";
  const [{ data: tenant }, { data: branch }] = await Promise.all([
    context.supabase.from("tenants").select("legal_name,legal_address,legal_contact_email").eq("id", tenantId).maybeSingle(),
    context.supabase.from("branches").select("name,public_registration_token").eq("tenant_id", tenantId).eq("status", "ACTIVE").order("name").limit(1).maybeSingle(),
  ]);
  const base = branch?.public_registration_token ? `/register/${encodeURIComponent(branch.public_registration_token)}` : null;
  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1>Datos legales</h1><p>Identifican a tu negocio como responsable en los documentos que ven tus clientes.</p></div></header>
    {query.saved === "1" ? <p className="enterprise-alert is-success" role="status">Datos legales guardados. Los documentos de tus clientes ya muestran la nueva información.</p> : null}
    <section className="enterprise-content-card" aria-labelledby="legal-profile-title">
      <h2 className="admin-card-title" id="legal-profile-title">Razón social y domicilio</h2>
      <p className="admin-card-copy">Aparecen en los términos y condiciones de tu programa y en tu aviso de privacidad.</p>
      <TenantLegalProfileForm initial={{ legalName: tenant?.legal_name ?? "", legalAddress: tenant?.legal_address ?? "", legalContactEmail: tenant?.legal_contact_email ?? "" }} />
    </section>
    <section className="enterprise-content-card" aria-labelledby="legal-documents-title">
      <h2 className="admin-card-title" id="legal-documents-title">Documentos para tus clientes</h2>
      {base ? <>
        <p className="admin-card-copy">Así los ven tus clientes al registrarse en {branch?.name}. Se enlazan desde el registro y desde cada tarjeta digital.</p>
        <p className="legal-profile-links"><Link className="enterprise-secondary-action" href={`${base}/terminos`} target="_blank">Ver términos y condiciones</Link><Link className="enterprise-secondary-action" href={`${base}/privacidad`} target="_blank">Ver aviso de privacidad</Link></p>
      </> : <p className="admin-card-copy">Activa una sucursal para consultar los documentos tal como los ven tus clientes.</p>}
    </section>
  </main>;
}
