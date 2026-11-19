import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { customerPrivacyMarkdown } from "@/content/legal/customer-privacy";
import { privacyMarkdown } from "@/content/legal/privacy";
import { termsMarkdown } from "@/content/legal/terms";
import { tenantCustomerTermsMarkdown } from "@/content/legal/tenant-customer-terms";
import { legalContactText, legalOperator, type LegalOperator, type TenantLegalIdentity } from "./company";
import { LegalMarkdown } from "./markdown";

const operator: LegalOperator = {
  ...legalOperator(),
  operatorName: "Operadora Ejemplo, S.A. de C.V.",
  address: "Calle 1, Hermosillo, Sonora, México",
  privacyEmail: "privacidad@example.com",
};

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
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
    ["plataforma", privacyMarkdown(operator)],
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

  it("only promises channels and rights the product supports", () => {
    const customers = customerPrivacyMarkdown(operator);
    expect(customers).not.toContain("WhatsApp o avisos");
    expect(customers).toContain("opción «Promociones» de tu tarjeta web");
    expect(customers).toContain("el historial de compras y premios se conserva sin datos que te identifiquen");
    expect(read("../../components/public-wallet-card.tsx")).toContain("/promociones`}>Promociones</a>");
    expect(read("../../components/public-registration-flow.tsx")).not.toContain("WhatsApp");
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

  it("protects the operator: no guaranteed results, extra work quoted, service orders and conformity", () => {
    expect(terms).toContain("no garantiza ningún resultado comercial");
    expect(terms).toContain("cotización por escrito aceptada por el Negocio");
    expect(terms).toContain("Orden de Servicio");
    expect(terms).toContain("prevalece sobre los precios publicados");
    expect(terms).toContain("Conformidad con el cobro");
    expect(terms).toContain("15 días naturales");
    expect(terms).toContain("Plataforma en desarrollo continuo");
    expect(terms).toContain("bonificación proporcional");
  });

  it("discloses support access, anonymized statistics, imports, assignment and notices", () => {
    expect(terms).toContain("sesiones de soporte temporales");
    expect(terms).toContain("agregadas y anonimizadas");
    expect(terms).toContain("que importe o capture directamente");
    expect(terms).toContain("honrar o resolver directamente los sellos, puntos y premios pendientes");
    expect(terms).toContain("## 18. Cesión");
    expect(terms).toContain("## 17. Notificaciones");
    expect(privacyMarkdown(operator)).toContain("sesiones de soporte temporales");
    expect(privacyMarkdown(operator)).toContain("Hostinger");
  });

  it("only references sections that exist", () => {
    const sections = new Set([...terms.matchAll(/^## (\d+)\./gm)].map((match) => match[1]));
    for (const match of terms.matchAll(/secci[oó]n (\d+)/g)) expect(sections.has(match[1])).toBe(true);
  });
});

describe("brand", () => {
  it("uses SwiftyCards, not the former brand, in legal surfaces", () => {
    expect(legalOperator().brand).toBe("SwiftyCards");
    for (const path of ["../../components/signup-form.tsx", "../../components/legal-consent-gate.tsx", "../../components/public-registration-flow.tsx", "../../content/legal/terms.ts", "../../content/legal/privacy.ts", "../../content/legal/customer-privacy.ts", "../../content/legal/tenant-customer-terms.ts"]) {
      expect(read(path).toLowerCase()).not.toContain("morrow");
    }
  });
});

describe("legal links where documents are accepted", () => {

  it("links the documents from signup, registration and the landing footer", () => {
    expect(read("../../components/signup-form.tsx")).toMatch(/href="\/terminos"[\s\S]*href="\/privacidad"/);
    const registration = read("../../components/public-registration-flow.tsx");
    expect(registration).toContain("href={`${legalBase}/privacidad`}");
    expect(registration).toContain("href={`${legalBase}/terminos`}");
    expect(read("../../components/customer-card-claim.tsx")).toContain("/terminos`}");
    expect(read("../../components/public-wallet-card.tsx")).toContain("/privacidad`}");
    const landing = read("../../app/page.tsx");
    expect(landing).toContain('<Link href="/terminos">Términos</Link>');
    expect(landing).toContain('<Link href="/privacidad">Privacidad</Link>');
  });
});

describe("business documents for loyalty customers (DEC-0072)", () => {
  const business: TenantLegalIdentity = {
    tenantName: "Café Ejemplo",
    legalName: "Café Ejemplo, S. de R.L. de C.V.",
    legalAddress: "Calle Dos 45, Centro, 83000 Hermosillo, Sonora",
    contactEmail: "hola@cafe.example",
  };

  it("names the business as controller with its domicile and contact channel", () => {
    const privacy = customerPrivacyMarkdown(operator, business);
    expect(privacy).toContain("# Aviso de Privacidad para Clientes de Café Ejemplo");
    expect(privacy).toContain(`**${business.legalName}**`);
    expect(privacy).toContain(`con domicilio en ${business.legalAddress}, es el **responsable**`);
    expect(privacy).toContain("el correo hola@cafe.example");
    expect(privacy).toContain("como encargado, por cuenta del negocio");
    expect(privacy).not.toContain("Puedes pedirle directamente su domicilio");
  });

  it("falls back to the generic controller text until the business completes its data", () => {
    const privacy = customerPrivacyMarkdown(operator, { ...business, legalName: null, legalAddress: null });
    expect(privacy).toContain("**El negocio que emite tu Tarjeta**");
    expect(privacy).toContain("Puedes pedirle directamente su domicilio");
  });

  it("terms identify the operator, link its privacy notice and respect white-label", () => {
    const terms = tenantCustomerTermsMarkdown(operator, business, "/register/abc/privacidad", false);
    expect(terms).toContain("# Términos y Condiciones del Programa de Lealtad de Café Ejemplo");
    expect(terms).toContain(`operado por **${business.legalName}**, con domicilio en ${business.legalAddress}`);
    expect(terms).toContain("[Aviso de Privacidad](/register/abc/privacidad)");
    expect(terms).toContain("no son canjeables por dinero en efectivo");
    expect(terms).toContain("se publican siempre en tu tarjeta web");
    expect(terms).not.toContain("antes de seguir usándola");
    expect(terms).toContain("Procuraduría Federal del Consumidor");
    expect(terms).toContain(`la plataforma **${operator.brand}**`);
    const whiteLabel = tenantCustomerTermsMarkdown(operator, { ...business, contactEmail: null }, "/card/x/privacidad", true);
    expect(whiteLabel).not.toContain(`**${operator.brand}**`);
    expect(whiteLabel).toContain("cualquiera de sus sucursales participantes");
  });

  it("renders business-written card conditions as plain text, never Markdown", () => {
    const source = read("../../components/tenant-legal-pages.tsx");
    expect(source).toContain('<p className="legal-card-conditions-text">{card.terms}</p>');
    expect(source).toContain("robots: { index: false, follow: false }");
  });
});
