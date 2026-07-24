import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { resolveScannedCard } from "./actions";

type ScanPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ScanPage({ searchParams }: ScanPageProps) {
  await requireInternalArea("APP");
  const { error } = await searchParams;
  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="scan-title">
        <Link className="text-link" href="/app">Volver</Link>
        <p className="eyebrow">PWA empleados</p>
        <h1 id="scan-title" className="auth-title">Escanear tarjeta</h1>
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        <p className="body-copy">Captura el contenido del QR para validar la tarjeta dentro de tu negocio.</p>
        <form className="auth-form" action={resolveScannedCard}>
          <label className="field"><span>Contenido del QR</span><input name="payload" autoComplete="off" required /></label>
          <button className="primary-button" type="submit">Validar tarjeta</button>
        </form>
      </section>
    </main>
  );
}
