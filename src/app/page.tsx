import Link from "next/link";
import { redirect } from "next/navigation";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { getStaffSessionContext } from "@/lib/auth/server";
import { getDefaultInternalRoute } from "@/lib/auth/routes";

export default async function HomePage() {
  let context = null;
  try { context = await getStaffSessionContext(); } catch { context = null; }
  if (context?.access.staffStatus === "PASSWORD_RESET_REQUIRED") redirect("/change-password");
  if (context?.access.staffStatus === "ACTIVE") redirect(getDefaultInternalRoute(context.access.role));

  return <main className="public-shell public-home-shell"><section className="public-home-card" aria-labelledby="home-title"><SwiftWalletBrand subtitle="Fidelidad digital" /><div className="public-home-copy"><p className="public-eyebrow">Centro de operación</p><h1 id="home-title">Programas de fidelidad simples de operar.</h1><p>Accede al área autorizada para administrar negocios, atender clientes y registrar operaciones.</p></div><Link className="public-primary-button" href="/login">Iniciar sesión</Link><p className="public-security-note">Los clientes no necesitan cuenta ni contraseña.</p></section></main>;
}
