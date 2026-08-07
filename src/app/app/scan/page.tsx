import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { resolveScannedCard } from "./actions";

type ScanPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ScanPage({ searchParams }: ScanPageProps) {
  await requireInternalArea("APP");
  const { error } = await searchParams;
  return <main className="operations-page">
    <header className="operations-page-header"><p>Tarjetas</p><h1 id="scan-title">Escanear tarjeta</h1><span>Valida el QR antes de iniciar una compra o canje.</span></header>
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    <section className="operations-card operations-scan-card" aria-labelledby="scan-title">
      <div className="operations-scan-target" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="operations-card-header"><h2>Contenido del QR</h2><p>La cámara se integrará aquí; mientras tanto captura o pega el contenido.</p></div>
      <form className="operations-form" action={resolveScannedCard}>
        <label className="field"><span>Token de la tarjeta</span><input name="payload" autoComplete="off" required /></label>
        <SubmitButton className="operations-primary-button">Validar tarjeta</SubmitButton>
      </form>
    </section>
  </main>;
}
