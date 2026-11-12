import Link from "next/link";
import { MorrowBrand } from "@/components/morrow-brand";
import { LegalMarkdown } from "@/lib/legal/markdown";

const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Aviso de privacidad" },
  { href: "/privacidad/clientes", label: "Privacidad para clientes" },
];

/** Shared layout for public legal documents. */
export function LegalDocument({ source, current }: { source: string; current: string }) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <MorrowBrand />
        <nav aria-label="Documentos legales">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.href === current ? "page" : undefined}>{link.label}</Link>
          ))}
        </nav>
      </header>
      <article className="legal-article">
        <LegalMarkdown source={source} />
      </article>
    </main>
  );
}
