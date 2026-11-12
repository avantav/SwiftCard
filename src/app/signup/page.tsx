import type { Metadata } from "next";
import Link from "next/link";
import { MorrowBrand } from "@/components/morrow-brand";
import { SignupForm, type SignupPlanOption } from "@/components/signup-form";
import { SELF_SERVICE_TRIAL_DAYS, stripeCheckoutConfig } from "@/lib/billing/stripe";
import { parseInterval, parsePlanCode } from "@/lib/billing/signup-validation";
import { salesWhatsAppLink } from "@/lib/marketing/demo-request";
import { formatPesos } from "@/lib/marketing/pricing";
import { loadPublicPricingPlans } from "@/lib/marketing/pricing-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crea tu cuenta · morrow",
  description: "Empieza tu prueba de 30 días de morrow.",
};

/** Trial end shown before checkout; Stripe computes the authoritative date. */
function formatTrialEnd(from: Date) {
  const end = new Date(from.getTime() + SELF_SERVICE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(end);
}

type SignupPageProps = { searchParams: Promise<{ plan?: string; interval?: string; canceled?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const plans = (await loadPublicPricingPlans()).filter((plan) => plan.selfService);
  const available = Boolean(stripeCheckoutConfig()) && plans.length > 0;
  const options: SignupPlanOption[] = plans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    monthlyLabel: formatPesos(plan.monthlyAmount),
    yearlyLabel: plan.yearlyAmount ? formatPesos(plan.yearlyAmount) : null,
    summary: plan.limits.join(" · "),
  }));
  const initialPlan = parsePlanCode(params.plan) && options.some((option) => option.code === params.plan) ? params.plan! : options[0]?.code ?? "inicial";
  const trialEndsLabel = formatTrialEnd(new Date());
  const whatsapp = salesWhatsAppLink("Hola, quiero contratar morrow para mi negocio.");

  return (
    <main className="public-shell">
      <div className="public-auth-layout">
        <MorrowBrand subtitle="Lealtad digital para tu negocio" />
        <section className="public-card" aria-labelledby="signup-title">
          <p className="public-eyebrow">Prueba de {SELF_SERVICE_TRIAL_DAYS} días</p>
          <h1 id="signup-title" className="auth-title">Crea tu cuenta</h1>
          {params.canceled ? <p className="enterprise-alert is-info" role="status">No se completó el pago. Puedes intentarlo de nuevo cuando quieras.</p> : null}
          {available ? (
            <SignupForm plans={options} initialPlan={initialPlan} initialInterval={parseInterval(params.interval)} trialEndsLabel={trialEndsLabel} />
          ) : (
            <>
              <p className="public-card-copy">El alta en línea no está disponible en este momento. Escríbenos y activamos tu cuenta hoy mismo.</p>
              <a className="public-primary-button" href={whatsapp.href} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>
            </>
          )}
        </section>
        <p className="public-security-note">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>. ¿Buscas el plan Empresarial? <a href={salesWhatsAppLink("Hola, me interesa el plan Empresarial de morrow para mi empresa.").href} target="_blank" rel="noopener noreferrer">Habla con ventas</a>.
        </p>
      </div>
    </main>
  );
}
