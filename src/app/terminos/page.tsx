import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { termsMarkdown } from "@/content/legal/terms";
import { legalOperator } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Términos y condiciones · morrow",
  description: "Términos y condiciones del servicio de la plataforma de lealtad digital morrow.",
};

export default function TermsPage() {
  return <LegalDocument source={termsMarkdown(legalOperator())} current="/terminos" />;
}
