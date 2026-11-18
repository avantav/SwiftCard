/**
 * Operator identity used by the public legal documents. Values not confirmed
 * yet by the owner/lawyer are configurable; see docs/legal/README.md.
 */
function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Version of the platform legal documents. Tenant staff must accept the
 * current value before using /admin or /app (DEC-0072); bump it only for a
 * change that requires new acceptance.
 */
export const LEGAL_VERSION = "1.1";
export const LEGAL_EFFECTIVE_DATE = "18 de noviembre de 2026";

export type LegalOperator = {
  brand: string;
  /** Legal name (razón social or natural person) operating the platform. */
  operatorName: string;
  address: string;
  privacyEmail: string | null;
  whatsapp: string;
  whatsappUrl: string;
  website: string;
  jurisdiction: string;
};

export function legalOperator(): LegalOperator {
  return {
    brand: "morrow",
    operatorName: env("NEXT_PUBLIC_LEGAL_OPERATOR_NAME") ?? "SwiftyCards, operador de la plataforma morrow",
    address: env("NEXT_PUBLIC_LEGAL_ADDRESS") ?? "Hermosillo, Sonora, México",
    privacyEmail: env("NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL") ?? "support@avantav.dev",
    whatsapp: "+52 662 171 1274",
    whatsappUrl: "https://wa.me/526621711274",
    website: env("SWIFTWALLET_PUBLIC_URL") ?? "https://swiftycards.com",
    jurisdiction: env("NEXT_PUBLIC_LEGAL_JURISDICTION") ?? "Hermosillo, Sonora",
  };
}

/** Human-readable contact channels for privacy and legal requests. */
export function legalContactText(operator: LegalOperator = legalOperator()) {
  return operator.privacyEmail
    ? `el correo ${operator.privacyEmail} o WhatsApp al ${operator.whatsapp}`
    : `WhatsApp al ${operator.whatsapp} (${operator.whatsappUrl})`;
}

/**
 * Legal identity a business records for the documents shown to its loyalty
 * customers (DEC-0072). `legalName`/`legalAddress` are null until the Admin
 * general completes them.
 */
export type TenantLegalIdentity = {
  tenantName: string;
  legalName: string | null;
  legalAddress: string | null;
  contactEmail: string | null;
};

/** How customers can reach the business for program or privacy requests. */
export function tenantContactText(business: TenantLegalIdentity) {
  return business.contactEmail
    ? `el correo ${business.contactEmail} o en cualquiera de sus sucursales`
    : "cualquiera de sus sucursales participantes";
}
