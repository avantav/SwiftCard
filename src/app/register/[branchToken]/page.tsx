import { PublicRegistrationFlow } from "@/components/public-registration-flow";
import { getPublicRegistrationContext } from "@/lib/customers/public-registration-context";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ branchToken: string }>; searchParams: Promise<{ card?: string }> }) {
  const { branchToken } = await params;
  const context = await getPublicRegistrationContext(branchToken);
  if (!context) {
    return <main className="public-shell"><section className="public-card public-unavailable-card"><h1>Este enlace no está activo</h1><p>Solicita al negocio un código QR vigente para crear tu tarjeta.</p></section></main>;
  }
  const { card } = await searchParams;
  const selected = context.cards.find((item) => item.id === card);
  if (selected) context.cards = [selected, ...context.cards.filter((item) => item.id !== selected.id)];
  return <PublicRegistrationFlow branchToken={branchToken} context={context} />;
}
