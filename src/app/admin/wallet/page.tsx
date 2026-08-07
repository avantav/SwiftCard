import { redirect } from "next/navigation";
import {
  AppleWalletDesignForm,
  type AppleWalletDesignValues,
} from "@/components/apple-wallet-design-form";
import { requireInternalArea } from "@/lib/auth/server";
import { walletProviderConfig } from "@/lib/wallet/service";

type WalletPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function WalletPage({ searchParams }: WalletPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const query = await searchParams;
  const [{ data: tenant, error: tenantError }, { data: savedDesign, error: designError }] =
    await Promise.all([
      context.supabase
        .from("tenants")
        .select("name,logo_url,banner_url,primary_color,secondary_color")
        .eq("id", context.tenantId)
        .maybeSingle(),
      context.supabase
        .from("tenant_wallet_designs")
        .select(
          "apple_enabled,logo_text,description,background_color,foreground_color,label_color,logo_image_url,strip_image_url,version",
        )
        .eq("tenant_id", context.tenantId)
        .maybeSingle(),
    ]);

  if (tenantError || designError || !tenant) {
    return (
      <main className="enterprise-page">
        <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1>Apple Wallet</h1><p>Diseña la tarjeta de fidelidad del tenant.</p></div></header>
        <section className="enterprise-content-card"><p className="enterprise-alert is-error" role="alert">No se pudo cargar la configuración de Apple Wallet. Confirma que la migración 0036 esté aplicada.</p></section>
      </main>
    );
  }

  const initial: AppleWalletDesignValues = savedDesign
    ? {
        appleEnabled: savedDesign.apple_enabled,
        logoText: savedDesign.logo_text,
        description: savedDesign.description,
        backgroundColor: savedDesign.background_color,
        foregroundColor: savedDesign.foreground_color,
        labelColor: savedDesign.label_color,
        logoImageUrl: savedDesign.logo_image_url ?? "",
        stripImageUrl: savedDesign.strip_image_url ?? "",
      }
    : {
        appleEnabled: false,
        logoText: tenant.name.slice(0, 60),
        description: `Tarjeta de recompensas de ${tenant.name}`.slice(0, 120),
        backgroundColor: tenant.secondary_color,
        foregroundColor: "#FFFFFF",
        labelColor: "#FFFFFF",
        logoImageUrl: tenant.logo_url ?? "",
        stripImageUrl: tenant.banner_url ?? "",
      };
  const signing = walletProviderConfig("APPLE");

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div><p className="enterprise-breadcrumb">Configuración · {tenant.name}</p><h1 id="apple-wallet-title">Apple Wallet</h1><p>Configura la identidad visual de la tarjeta que descargarán tus clientes.</p></div>
      </header>
      <section className="apple-wallet-status" aria-label="Estado de Apple Wallet">
        <span className={`enterprise-badge ${signing.configured ? "is-active" : "is-suspended"}`}>{signing.configured ? "Firma configurada" : "Firma pendiente"}</span>
        <p>{signing.configured ? "El servidor puede generar archivos .pkpass firmados." : "El diseño puede guardarse, pero la descarga permanecerá oculta hasta configurar las credenciales Apple en el servidor."}</p>
        {savedDesign ? <small>Versión de diseño {savedDesign.version}</small> : <small>Diseño inicial sin publicar</small>}
      </section>
      {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
      {query.saved ? <p className="enterprise-alert is-success" role="status">Diseño de Apple Wallet actualizado.</p> : null}
      <AppleWalletDesignForm initial={initial} />
    </main>
  );
}
