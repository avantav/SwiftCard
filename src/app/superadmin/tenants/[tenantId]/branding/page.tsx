import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { updateTenantBranding } from "./actions";

type BrandingPageProps = { params: Promise<{ tenantId: string }>; searchParams: Promise<{ error?: string; saved?: string }> };

export default async function BrandingPage({ params, searchParams }: BrandingPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { tenantId } = await params;
  const query = await searchParams;
  const { data: tenant } = await context.supabase.from("tenants").select("id,name,branding_mode,logo_url,banner_url,primary_color,secondary_color").eq("id", tenantId).maybeSingle();
  if (!tenant) notFound();
  return <main className="shell"><section className="panel" aria-labelledby="branding-title"><Link className="text-link" href="/superadmin">Volver</Link><p className="eyebrow">Branding</p><h1 id="branding-title" className="form-title">{tenant.name}</h1>{query.error ? <p className="error-alert" role="alert">{query.error}</p> : null}{query.saved ? <p className="success-alert" role="status">Branding actualizado.</p> : null}<form className="auth-form" action={updateTenantBranding}><input type="hidden" name="tenantId" value={tenant.id} /><label className="field"><span>Modo</span><select name="brandingMode" defaultValue={tenant.branding_mode}><option value="STANDARD">Estándar</option><option value="WHITE_LABEL">White-label</option></select></label><label className="field"><span>Logo HTTPS</span><input name="logoUrl" type="url" defaultValue={tenant.logo_url ?? ""} /></label><label className="field"><span>Banner HTTPS</span><input name="bannerUrl" type="url" defaultValue={tenant.banner_url ?? ""} /></label><div className="form-grid"><label className="field"><span>Color primario</span><input name="primaryColor" type="text" defaultValue={tenant.primary_color} /></label><label className="field"><span>Color secundario</span><input name="secondaryColor" type="text" defaultValue={tenant.secondary_color} /></label></div><button className="primary-button" type="submit">Guardar branding</button></form></section></main>;
}
