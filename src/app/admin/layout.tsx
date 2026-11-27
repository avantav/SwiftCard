import { Suspense, type ReactNode } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { ToastRegion } from "@/components/admin/toast-region";
import { LegalConsentGate } from "@/components/legal-consent-gate";
import { acceptPlatformLegalTerms, completeAdminLegalOnboarding } from "@/app/legal-consent/actions";
import { requireInternalArea } from "@/lib/auth/server";
import { legalConsentPending } from "@/lib/legal/consent";
import { getLegalConsentStatus } from "@/lib/legal/consent-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("ADMIN");
  const role = context.access.role === "ADMIN" ? "ADMIN" : "MANAGER";
  // Support sessions never accept on behalf of the tenant (DEC-0072).
  const legal = context.supportSession ? null : await getLegalConsentStatus(context.supabase);
  const gate = legal && legalConsentPending(legal)
    ? <LegalConsentGate status={legal} action={legal.canEditCompany ? completeAdminLegalOnboarding : acceptPlatformLegalTerms.bind(null, "ADMIN")} />
    : null;
  return <div className={`enterprise-app is-admin-app${context.supportSession ? " has-support-session" : ""}`}><Suspense fallback={null}><ToastRegion /></Suspense><AdminNavigation email={context.email} role={role} supportMode={Boolean(context.supportSession)} /><div className="enterprise-main">{context.supportSession ? <aside className="support-session-banner" role="status"><div><strong>Modo soporte · {context.supportSession.tenantName}</strong><span>Sucursales y ubicación/GPS editables · La sesión vence automáticamente en una hora.</span></div><form action="/support/exit" method="post"><button type="submit">Salir del modo soporte</button></form></aside> : null}{gate ?? children}</div></div>;
}
