import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { customerPrivacyMarkdown } from "@/content/legal/customer-privacy";
import { privacyMarkdown } from "@/content/legal/privacy";
import { termsMarkdown } from "@/content/legal/terms";
import { legalContactText, legalOperator, type LegalOperator } from "./company";
import { LegalMarkdown } from "./markdown";

const operator: LegalOperator = {
  ...legalOperator(),
  operatorName: "Operadora Ejemplo, S.A. de C.V.",
  address: "Calle 1, Hermosillo, Sonora, México",
  privacyEmail: "privacidad@example.com",
};

const render = (source: string) => renderToStaticMarkup(<LegalMarkdown source={source} />);

describe("legal markdown renderer", () => {
  it("renders headings, lists, bold and safe links without raw HTML", () => {
    const html = render("# Título\n\nTexto **fuerte** y [aviso](/privacidad).\n\n- uno\n- [externo](https://example.com)\n\n<script>alert(1)</script> [malo](javascript:alert(1))");
    expect(html).toContain('<h1 id="titulo">Título</h1>');
    expect(html).toContain("<strong>fuerte</strong>");
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });
});

describe("privacy notices (LFPDPPP 2025, art. 15)", () => {
  for (const [name, source] of [
    ["morrow", privacyMarkdown(operator)],
    ["clientes", customerPrivacyMarkdown(operator)],
  ] as const) {
    it(`${name}: identifies the controller, data, purposes, limits, ARCO and changes`, () => {
      expect(source).toContain(operator.operatorName);
      expect(source).toContain(operator.address);
      expect(source).toMatch(/Datos (personales )?que (tratamos|se tratan)/);
      expect(source).toMatch(/Finalidades necesarias/);
      expect(source).toMatch(/consentimiento|autorizas/);
      expect(source).toContain("20 días");
      expect(source).toContain("15 días");
      expect(source).toContain("Secretaría Anticorrupción y Buen Gobierno");
      expect(source).toMatch(/Cambios/);
      expect(source).toContain("privacidad@example.com");
    });
  }

  it("states that each business is the controller of its customers' data", () => {
    expect(customerPrivacyMarkdown(operator)).toContain("es el **responsable**");
    expect(customerPrivacyMarkdown(operator)).toContain("como encargado, por cuenta del negocio");
    expect(customerPrivacyMarkdown(operator)).toContain("No se recaba tu ubicación");
  });

  it("falls back to WhatsApp when no privacy mailbox is configured", () => {
    expect(legalContactText({ ...operator, privacyEmail: null })).toBe("WhatsApp al +52 662 171 1274 (https://wa.me/526621711274)");
  });
});

describe("terms of service", () => {
  const terms = termsMarkdown(operator);

  it("covers the trial, renewal, cancellation, VAT and the processor clause", () => {
    expect(terms).toContain("30 días naturales");
    expect(terms).toContain("se cobra automáticamente");
    expect(terms).toContain("se renuevan automáticamente");
    expect(terms).toContain("al final del periodo pagado");
    expect(terms).toContain("no incluyen el IVA");
    expect(terms).toContain("el Negocio es el responsable");
    expect(terms).toContain(`${operator.brand} actúa como encargado`);
    expect(terms).toContain("Ley aplicable y jurisdicción");
  });
});

describe("legal links where documents are accepted", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("links the documents from signup, registration and the landing footer", () => {
    expect(read("../../components/signup-form.tsx")).toMatch(/href="\/terminos"[\s\S]*href="\/privacidad"/);
    expect(read("../../components/public-registration-flow.tsx")).toContain('href="/privacidad/clientes"');
    const landing = read("../../app/page.tsx");
    expect(landing).toContain('<Link href="/terminos">Términos</Link>');
    expect(landing).toContain('<Link href="/privacidad">Privacidad</Link>');
  });
});
