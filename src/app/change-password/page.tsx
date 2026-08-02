import { requirePasswordChangeContext } from "@/lib/auth/server";
import { SubmitButton } from "@/components/submit-button";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { changeRequiredPassword } from "./actions";

export const dynamic = "force-dynamic";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ChangePasswordPage({
  searchParams
}: ChangePasswordPageProps) {
  await requirePasswordChangeContext();
  const { error } = await searchParams;

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
      <SwiftWalletBrand subtitle="Seguridad de la cuenta" />
      <section className="public-card" aria-labelledby="change-password-title">
        <p className="public-eyebrow">Primer acceso</p>
        <h1 id="change-password-title" className="auth-title">
          Cambiar contraseña
        </h1>
        {error ? (
          <p className="enterprise-alert is-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="public-card-copy">Crea una contraseña personal de al menos 12 caracteres para continuar.</p>
        <form className="public-form" action={changeRequiredPassword}>
          <label className="field">
            <span>Contraseña temporal</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              name="newPassword"
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>Confirmar nueva contraseña</span>
            <input
              name="passwordConfirmation"
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          <SubmitButton className="public-primary-button">Guardar contraseña</SubmitButton>
        </form>
      </section>
      </div>
    </main>
  );
}
