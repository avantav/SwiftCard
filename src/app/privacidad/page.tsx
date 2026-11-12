import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { privacyMarkdown } from "@/content/legal/privacy";
import { legalOperator } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Aviso de privacidad · morrow",
  description: "Aviso de privacidad integral de la plataforma morrow.",
};

export default function PrivacyPage() {
  return <LegalDocument source={privacyMarkdown(legalOperator())} current="/privacidad" />;
}
