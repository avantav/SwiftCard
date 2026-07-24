import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSessionContext } from "@/lib/auth/server";
import { getDefaultInternalRoute } from "@/lib/auth/routes";

export default async function HomePage() {
  let context = null;
  try {
    context = await getStaffSessionContext();
  } catch {
    context = null;
  }
  if (context?.access.staffStatus === "PASSWORD_RESET_REQUIRED") redirect("/change-password");
  if (context?.access.staffStatus === "ACTIVE") redirect(getDefaultInternalRoute(context.access.role));

  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="home-title">
        <p className="eyebrow">SwiftWallet</p>
        <h1 id="home-title" className="auth-title">Operación de fidelidad digital</h1>
        <p className="body-copy">Inicia sesión para acceder al área autorizada de tu rol.</p>
        <div className="action-row"><Link className="primary-link" href="/login">Iniciar sesión</Link></div>
        <nav className="action-row" aria-label="Rutas públicas"><Link className="text-link" href="/register/example-branch-token">Registro público</Link><Link className="text-link" href="/card/example-card-token">Web Card</Link></nav>
      </section>
    </main>
  );
}
