import type { ReactNode } from "react";
import type { Viewport } from "next";
import { OperationsNavigation } from "@/components/operations-navigation";
import { PwaController } from "@/components/pwa-controller";
import { redirect } from "next/navigation";
import { LegalConsentGate } from "@/components/legal-consent-gate";
import { acceptPlatformLegalTerms } from "@/app/legal-consent/actions";
import { requireInternalArea } from "@/lib/auth/server";
import { legalConsentPending } from "@/lib/legal/consent";
import { getLegalConsentStatus } from "@/lib/legal/consent-server";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#149c91",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default async function EmployeeAppLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("APP", { allowLockedShared: true });
  const { data: tenant } = await context.supabase
    .from("tenants")
    .select("name,logo_url")
    .eq("id", context.tenantId)
    .maybeSingle();
  // Platform terms first (DEC-0072); the Admin general completes the business
  // legal identity in /admin. Locked shared devices unlock before this.
  const legal = context.supportSession ? null : await getLegalConsentStatus(context.supabase);
  const pending = legal && legalConsentPending(legal) ? legal : null;
  if (pending?.canEditCompany) redirect("/admin");
  const content = pending
    ? <LegalConsentGate status={pending} action={acceptPlatformLegalTerms.bind(null, "APP")} operatorName={context.pinOperator?.fullName ?? null} />
    : children;
  return <div className="operations-app"><OperationsNavigation accountKind={context.accountKind} operatorName={context.pinOperator?.fullName ?? null} tenantLogoUrl={tenant?.logo_url ?? null} tenantName={tenant?.name ?? "Negocio"} /><div className="operations-main"><PwaController />{content}</div></div>;
}
