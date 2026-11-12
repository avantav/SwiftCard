import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { customerPrivacyMarkdown } from "@/content/legal/customer-privacy";
import { legalOperator } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Privacidad para clientes · morrow",
  description: "Aviso de privacidad para las personas registradas en programas de lealtad que usan morrow.",
};

export default function CustomerPrivacyPage() {
  return <LegalDocument source={customerPrivacyMarkdown(legalOperator())} current="/privacidad/clientes" />;
}
