import type { Metadata } from "next";
import Link from "next/link";
import { MorrowBrand } from "@/components/morrow-brand";
import { signupStatusForCheckoutSession } from "@/lib/billing/self-service-signup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cuenta creada · morrow" };

type SuccessPageProps = { searchParams: Promise<{ session_id?: string }> };

export default async function SignupSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  const status = sessionId ? await signupStatusForCheckoutSession(sessionId) : "UNKNOWN";

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
        <MorrowBrand subtitle="Lealtad digital para tu negocio" />
        <section className="public-card" aria-labelledby="signup-success-title">
          <p className="public-eyebrow">Prueba de 30 días</p>
          <h1 id="signup-success-title" className="auth-title">
            {status === "COMPLETED" ? "Tu cuenta está lista" : "Estamos activando tu cuenta"}
          </h1>
          <p className="public-card-copy" role="status">
            {status === "COMPLETED"
              ? "Inicia sesión con el correo y la contraseña que registraste para configurar tu programa de lealtad."
              : status === "PENDING"
                ? "Recibimos tu registro. La activación tarda unos segundos; recarga esta página o inicia sesión en un momento."
                : "Si completaste el pago, tu cuenta se activará en unos segundos. Inicia sesión con el correo que registraste."}
          </p>
          <Link className="public-primary-button" href="/login">Iniciar sesión</Link>
        </section>
      </div>
    </main>
  );
}
