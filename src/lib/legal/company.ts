/**
 * Operator identity used by the public legal documents. Values not confirmed
 * yet by the owner/lawyer are configurable; see docs/legal/README.md.
 */
function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const LEGAL_VERSION = "1.0";
export const LEGAL_EFFECTIVE_DATE = "12 de noviembre de 2026";

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
