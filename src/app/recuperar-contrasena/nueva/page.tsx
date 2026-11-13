import type { Metadata } from "next";
import Link from "next/link";
import { MorrowBrand } from "@/components/morrow-brand";
import { SubmitButton } from "@/components/submit-button";
import { isRecoveryToken } from "@/lib/auth/password-recovery";
import { completePasswordRecovery } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nueva contraseña · morrow",
  robots: { index: false, follow: false },
  // The recovery token is in the URL: never send it to other sites.
  referrer: "no-referrer"
};

type NewPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function NewPasswordPage({ searchParams }: NewPasswordPageProps) {
  const { token, error } = await searchParams;
  const validToken = isRecoveryToken(token);

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
        <MorrowBrand subtitle="Seguridad de la cuenta" />
        <section className="public-card" aria-labelledby="new-password-title">
          <p className="public-eyebrow">Administrador general</p>
          <h1 id="new-password-title" className="auth-title">
            Crear nueva contraseña
          </h1>
          {!validToken ? (
            <>
              <p className="enterprise-alert is-error" role="alert">
                El enlace no es válido o ya caducó.
              </p>
              <p className="public-card-copy">
                <Link href="/recuperar-contrasena">Solicitar un enlace nuevo</Link>
              </p>
            </>
          ) : (
            <>
              {error ? (
                <p className="enterprise-alert is-error" role="alert">
                  {error.slice(0, 160)}
                </p>
              ) : null}
              <p className="public-card-copy">Usa al menos 12 caracteres. Al guardarla se cerrarán tus otras sesiones.</p>
              <form className="public-form" action={completePasswordRecovery}>
                <input type="hidden" name="token" value={token} />
                <label className="field">
                  <span>Nueva contraseña</span>
                  <input name="newPassword" type="password" minLength={12} maxLength={72} autoComplete="new-password" required />
                </label>
                <label className="field">
                  <span>Confirmar nueva contraseña</span>
                  <input name="passwordConfirmation" type="password" minLength={12} maxLength={72} autoComplete="new-password" required />
                </label>
                <SubmitButton className="public-primary-button">Guardar contraseña</SubmitButton>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
