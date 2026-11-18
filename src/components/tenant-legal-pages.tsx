/* Tenant artwork uses validated HTTPS URLs. */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument, tenantLegalLinks } from "@/components/legal-document";
import { customerPrivacyMarkdown } from "@/content/legal/customer-privacy";
import { tenantCustomerTermsMarkdown } from "@/content/legal/tenant-customer-terms";
import { legalOperator } from "@/lib/legal/company";
import type { TenantLegalDocumentsContext } from "@/lib/legal/tenant-documents";

/** Business documents live under private tokens: never indexed. */
export const tenantLegalMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: false },
});

function TenantBrand({ context }: { context: TenantLegalDocumentsContext }) {
  return <p className="legal-tenant-brand">
    {context.logoUrl ? <img src={context.logoUrl} alt="" width={40} height={40} /> : null}
    <span>{context.business.tenantName}</span>
  </p>;
}

export function TenantTermsPage({ context }: { context: TenantLegalDocumentsContext | null }) {
  if (!context) notFound();
  const links = tenantLegalLinks(context.basePath);
  const source = tenantCustomerTermsMarkdown(legalOperator(), context.business, links[1]!.href, context.whiteLabel);
  return <LegalDocument source={source} current={links[0]!.href} links={links} brand={<TenantBrand context={context} />}>
    <h2 id="condiciones-particulares">11. Condiciones particulares de cada tarjeta</h2>
    {context.cards.length ? context.cards.map((card) => <section key={`${card.cardName}-${card.programName}`} className="legal-card-conditions" aria-label={card.cardName}>
      <h3>{card.cardName}</h3>
      <p className="legal-card-conditions-program">Programa: {card.programName}</p>
      <p className="legal-card-conditions-text">{card.terms}</p>
    </section>) : <p>Este negocio no tiene tarjetas publicadas en este momento.</p>}
  </LegalDocument>;
}

export function TenantPrivacyPage({ context }: { context: TenantLegalDocumentsContext | null }) {
  if (!context) notFound();
  const links = tenantLegalLinks(context.basePath);
  return <LegalDocument source={customerPrivacyMarkdown(legalOperator(), context.business)} current={links[1]!.href} links={links} brand={<TenantBrand context={context} />} />;
}
