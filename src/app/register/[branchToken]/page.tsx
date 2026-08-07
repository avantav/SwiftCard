import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { getPublicRegistrationContext } from "@/lib/customers/public-registration-context";
import { registerCustomer } from "./actions";

type RegisterPageProps = { params: Promise<{ branchToken: string }>; searchParams: Promise<{ created?: string; duplicate?: string; error?: string; cardToken?: string }> };

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { branchToken } = await params;
  const { created, duplicate, error, cardToken } = await searchParams;
  const registrationContext = await getPublicRegistrationContext(branchToken);
  const action = registerCustomer.bind(null, branchToken);

  if (!registrationContext) {
    return <main className="public-shell public-registration-shell"><div className="public-auth-layout public-registration-layout"><SwiftWalletBrand subtitle="Registro de cliente" /><section className="public-card" aria-labelledby="registration-title"><p className="public-eyebrow">Registro no disponible</p><h1 id="registration-title" className="auth-title">Este enlace no está activo</h1><p className="public-card-copy">Solicita al negocio un código QR vigente para crear tu tarjeta.</p></section></div></main>;
  }

  return <main className="public-shell public-registration-shell"><div className="public-auth-layout public-registration-layout"><SwiftWalletBrand subtitle="Registro de cliente" />
    <section className="public-card" aria-labelledby="registration-title"><p className="public-eyebrow">{registrationContext.tenantName} · {registrationContext.branchName}</p><h1 id="registration-title" className="auth-title">Crear mi tarjeta</h1><p className="public-card-copy">Registra tus datos para recibir una tarjeta digital válida en las sucursales participantes.</p>
    {created && cardToken ? <div className="public-success-state" role="status"><span aria-hidden="true">✓</span><h2>Tu tarjeta está lista</h2><p>Guarda el enlace para consultar tus sellos y recompensas.</p><Link className="public-primary-button" href={`/card/${encodeURIComponent(cardToken)}`}>Abrir mi tarjeta</Link></div> : null}
    {duplicate ? <p className="enterprise-alert is-error" role="alert">Este teléfono ya está registrado. Solicita ayuda a un empleado para recuperar tu tarjeta.</p> : null}
    {error ? <p className="enterprise-alert is-error" role="alert">{error}</p> : null}
    {!created ? <form className="public-form" action={action}>
      <label className="field"><span>Nombre completo</span><input name="fullName" required autoComplete="name" /></label>
      <label className="field"><span>Teléfono</span><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" /></label>
      <label className="field"><span>Correo electrónico <small>(opcional)</small></span><input name="email" type="email" inputMode="email" autoComplete="email" /></label>
      <label className="field"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="birthDate" type="date" /></label>
      <label className="check-field public-check"><input name="privacyConsent" type="checkbox" required /><span>Acepto el aviso de privacidad.</span></label>
      <SubmitButton className="public-primary-button">Crear mi tarjeta</SubmitButton>
    </form> : null}</section><p className="public-security-note">Tu información se utiliza únicamente para operar este programa de fidelidad.</p></div></main>;
}
