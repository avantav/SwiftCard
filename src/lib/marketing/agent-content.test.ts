import { describe, expect, it } from "vitest";
import type { LegalOperator } from "@/lib/legal/company";
import {
  homeJsonLd,
  homeMarkdown,
  llmsTxt,
  organizationSameAs,
  robotsTxt,
  serializeJsonLd
} from "./agent-content";
import { PUBLIC_PAGES } from "./agent-content";
import { landingFaq } from "./faq";
import type { PricingPlan } from "./pricing";

const operator: LegalOperator = {
  brand: "morrow",
  operatorName: "Operador",
  address: "Hermosillo, Sonora, México",
  privacyEmail: "support@example.com",
  whatsapp: "+52 662 000 0000",
  whatsappUrl: "https://wa.me/526620000000",
  website: "https://example.com/",
  jurisdiction: "Hermosillo, Sonora"
};

const plan: PricingPlan = {
  code: "inicial",
  name: "Inicial",
  tagline: "Para empezar.",
  features: [{ label: "Clientes ilimitados" }, { label: "Regalos", soon: true }],
  ctaLabel: "Empezar",
  ctaMessage: "Hola",
  monthlyAmount: 49900,
  yearlyAmount: 499000,
  limits: ["1 sucursal"],
  selfService: true
};

describe("robotsTxt", () => {
  it("declares content signals, private areas and the sitemap", () => {
    const body = robotsTxt("https://example.com");
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /scan");
    expect(body).toContain("Sitemap: https://example.com/sitemap.xml");
  });
});

describe("markdown negotiation", () => {
  it("rewrites exactly the public pages to their Markdown alternates", async () => {
    const configUrl = new URL("../../../next.config.mjs", import.meta.url).href;
    const { MARKDOWN_ALTERNATES } = (await import(/* @vite-ignore */ configUrl)) as {
      MARKDOWN_ALTERNATES: Array<{ source: string; destination: string }>;
    };
    expect(MARKDOWN_ALTERNATES).toEqual(
      PUBLIC_PAGES.map((page) => ({ source: page.path, destination: page.markdown }))
    );
  });
});

describe("llms.txt and Markdown", () => {
  it("summarises the site with absolute links, plans and contact", () => {
    const body = llmsTxt([plan], operator);
    expect(body.startsWith("# morrow\n\n> ")).toBe(true);
    expect(body).toContain("(https://example.com/index.md)");
    expect(body).toContain("**Inicial**");
    expect(body).not.toContain("Regalos");
    expect(body).toContain("support@example.com");
  });

  it("renders the homepage FAQ in Markdown", () => {
    const body = homeMarkdown([plan], landingFaq(true), operator);
    expect(body).toContain("### ¿Puedo contratar y pagar desde este sitio?");
    expect(body).toContain("Elige el plan Inicial o Crecimiento");
  });
});

describe("JSON-LD", () => {
  it("describes the organization, site, software offers and FAQ", () => {
    const data = homeJsonLd([plan], landingFaq(false), operator);
    const types = data["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]);
    const organization = data["@graph"][0]!;
    expect(organization).toMatchObject({
      url: "https://example.com",
      email: "support@example.com",
      address: { addressLocality: "Hermosillo", addressRegion: "Sonora", addressCountry: "MX" }
    });
    expect(data["@graph"][2]).toMatchObject({ offers: [{ price: "499.00", priceCurrency: "MXN" }] });
  });

  it("keeps only https profiles in sameAs", () => {
    expect(organizationSameAs("https://instagram.com/morrow, javascript:alert(1), ,http://x.com")).toEqual([
      "https://instagram.com/morrow"
    ]);
    expect(organizationSameAs(undefined)).toEqual([]);
  });

  it("cannot close the script tag", () => {
    expect(serializeJsonLd({ text: "</script><b>&" })).not.toMatch(/[<>&]/);
  });
});
