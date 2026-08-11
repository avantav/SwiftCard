import { CustomerCardScanner } from "@/components/customer-card-scanner";
import { requireInternalArea } from "@/lib/auth/server";

type ScanPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ScanPage({ searchParams }: ScanPageProps) {
  await requireInternalArea("APP");
  const { error } = await searchParams;
  return <main className="operations-page">
    <header className="operations-page-header"><p>Tarjetas</p><h1 id="scan-title">Escanear tarjeta</h1><span>Valida el QR antes de iniciar una compra o canje.</span></header>
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    <section className="operations-card operations-scan-card" aria-labelledby="scan-title">
      <div className="operations-card-header"><h2>Identificar cliente</h2><p>Escanea la tarjeta desde Apple Wallet o desde su versión web.</p></div>
      <CustomerCardScanner />
    </section>
  </main>;
}
