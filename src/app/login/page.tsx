import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { SubmitButton } from "@/components/submit-button";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { signInWithPassword } from "./actions";

const errorMessages: Record<string, string> = {
  account_unavailable: "La cuenta está inactiva o el tenant está suspendido.",
  auth_not_configured: "La autenticación todavía no está configurada.",
  invalid_credentials: "Correo o contraseña inválidos.",
  missing_credentials: "Ingresa correo y contraseña."
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(params.next);
  const error = params.error ? errorMessages[params.error] : null;

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
      <SwiftWalletBrand subtitle="Operación de fidelidad" />
      <section className="public-card" aria-labelledby="login-title">
        <p className="public-eyebrow">Acceso interno</p>
        <h1 id="login-title" className="auth-title">
          Iniciar sesión
        </h1>
        {error ? (
          <p className="enterprise-alert is-error" role="alert">
            {error}
          </p>
        ) : null}
        <form className="public-form" action={signInWithPassword}>
          <input type="hidden" name="next" value={nextPath} />
          <label className="field">
            <span>Correo</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <SubmitButton className="public-primary-button">Iniciar sesión</SubmitButton>
        </form>
      </section>
      <p className="public-security-note">Acceso protegido para personal autorizado.</p>
      </div>
    </main>
  );
}
