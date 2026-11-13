import type { Metadata } from "next";
import Link from "next/link";
import { MorrowBrand } from "@/components/morrow-brand";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordRecovery } from "./actions";

export const metadata: Metadata = {
  title: "Recuperar contraseña · morrow",
  robots: { index: false, follow: false }
};

const errorMessages: Record<string, string> = {
  invalid_email: "Ingresa un correo válido.",
  invalid_link: "El enlace no es válido o ya caducó. Solicita uno nuevo.",
  reset_failed: "No se pudo cambiar la contraseña. Solicita un enlace nuevo."
};

type RecoveryPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function PasswordRecoveryPage({ searchParams }: RecoveryPageProps) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;
  const sent = params.sent === "1";

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
        <MorrowBrand subtitle="Seguridad de la cuenta" />
        <section className="public-card" aria-labelledby="recovery-title">
          <p className="public-eyebrow">Administrador general</p>
          <h1 id="recovery-title" className="auth-title">
            Recuperar contraseña
          </h1>
          {error ? (
            <p className="enterprise-alert is-error" role="alert">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p className="enterprise-alert is-success" role="status">
              Si el correo pertenece al administrador general de un negocio activo, recibirás un enlace en unos minutos. Revisa también tu carpeta de spam.
            </p>
          ) : (
            <>
              <p className="public-card-copy">
                Escribe el correo con el que inicias sesión y te enviaremos un enlace para crear una contraseña nueva.
              </p>
              <form className="public-form" action={requestPasswordRecovery}>
                <label className="field">
                  <span>Correo</span>
                  <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required />
                </label>
                <SubmitButton className="public-primary-button">Enviar enlace</SubmitButton>
              </form>
            </>
          )}
          <p className="public-card-copy">
            Si eres administrador de sucursal o empleado, pide a tu administrador que restablezca tu contraseña.
          </p>
          <p className="public-card-copy">
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
