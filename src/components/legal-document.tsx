import Link from "next/link";
import type { ReactNode } from "react";
import { MorrowBrand } from "@/components/morrow-brand";
import { LegalMarkdown } from "@/lib/legal/markdown";

type LegalLink = { href: string; label: string };

const LEGAL_LINKS: LegalLink[] = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Aviso de privacidad" },
  { href: "/privacidad/clientes", label: "Privacidad para clientes" },
];

/**
 * Shared layout for public legal documents. Business documents (DEC-0072)
 * pass their own brand, links and an extra section rendered after the text.
 */
export function LegalDocument({ source, current, brand, links = LEGAL_LINKS, children }: {
  source: string;
  current: string;
  brand?: ReactNode;
  links?: LegalLink[];
  children?: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        {brand ?? <MorrowBrand />}
        <nav aria-label="Documentos legales">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.href === current ? "page" : undefined}>{link.label}</Link>
          ))}
        </nav>
      </header>
      <article className="legal-article">
        <LegalMarkdown source={source} />
        {children}
      </article>
    </main>
  );
}

/** Links between the two documents a business shows its customers. */
export function tenantLegalLinks(basePath: string): LegalLink[] {
  return [
    { href: `${basePath}/terminos`, label: "Términos y condiciones" },
    { href: `${basePath}/privacidad`, label: "Aviso de privacidad" },
  ];
}
