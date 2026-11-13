/**
 * Machine-readable descriptions of the public site for search engines and AI
 * agents: robots.txt, llms.txt, Markdown alternates and JSON-LD. Everything is
 * derived from the same sources as the visible pages (legal operator, pricing
 * catalog, FAQ) so agents never read claims the site does not make.
 */
import { customerPrivacyMarkdown } from "@/content/legal/customer-privacy";
import { privacyMarkdown } from "@/content/legal/privacy";
import { termsMarkdown } from "@/content/legal/terms";
import { legalOperator, type LegalOperator } from "@/lib/legal/company";
import type { FaqItem } from "./faq";

/**
 * Public pages listed in the sitemap, each with its Markdown alternate. The
 * Accept-based rewrites and Link headers live in next.config.mjs.
 */
export const PUBLIC_PAGES = [
  { path: "/", markdown: "/index.md", title: "Inicio", changeFrequency: "weekly", priority: 1 },
  { path: "/terminos", markdown: "/terminos.md", title: "Términos y condiciones", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacidad", markdown: "/privacidad.md", title: "Aviso de privacidad", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacidad/clientes", markdown: "/privacidad/clientes.md", title: "Privacidad para clientes", changeFrequency: "yearly", priority: 0.3 }
] as const;
import { formatPesos, type PricingPlan } from "./pricing";

export const SITE_NAME = "morrow";
export const SITE_TAGLINE = "Lealtad digital que hace volver a tus clientes";
export const SITE_DESCRIPTION =
  "Crea un programa de lealtad fácil de usar, entrega tarjetas para Apple Wallet y Google Wallet y entiende qué hace volver a tus clientes.";

export function siteUrl(operator: LegalOperator = legalOperator()) {
  return operator.website.replace(/\/+$/, "");
}

/** Private areas: application, staff tools, APIs and per-customer links. */
const DISALLOWED_PATHS = ["/admin", "/app", "/superadmin", "/api", "/scan", "/card", "/register", "/change-password", "/logout", "/support"];

export function robotsTxt(origin = siteUrl()) {
  return [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    ""
  ].join("\n");
}

/** Comma-separated https profile URLs (social, directories) for schema.org sameAs. */
export function organizationSameAs(raw = process.env.NEXT_PUBLIC_ORGANIZATION_SAME_AS) {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^https:\/\/[^\s]+$/.test(value));
}

function planLine(plan: PricingPlan) {
  const price = `${plan.startingAt ? "desde " : ""}${formatPesos(plan.monthlyAmount)} al mes + IVA`;
  const yearly = plan.yearlyAmount ? ` (o ${formatPesos(plan.yearlyAmount)} al año)` : "";
  return `- **${plan.name}**: ${price}${yearly}. ${plan.tagline} Incluye: ${[...plan.limits, ...plan.features.filter((f) => !f.soon).map((f) => f.label)].join("; ")}.`;
}

function contactLines(operator: LegalOperator) {
  return [
    `- WhatsApp: ${operator.whatsapp} (${operator.whatsappUrl})`,
    ...(operator.privacyEmail ? [`- Correo: ${operator.privacyEmail}`] : []),
    `- Ubicación: ${operator.address}`
  ];
}

export function llmsTxt(plans: PricingPlan[], operator: LegalOperator = legalOperator()) {
  const origin = siteUrl(operator);
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} es una plataforma SaaS mexicana de lealtad digital para negocios locales (cafés, restaurantes, retail, estéticas y servicios). Los negocios crean programas de visitas, compras o puntos y entregan tarjetas en Apple Wallet, Google Wallet o web; su equipo registra compras escaneando un QR.`,
    "",
    "Los clientes finales no descargan una app ni crean una cuenta: se registran con el QR del negocio. Los precios están en pesos mexicanos (MXN) más IVA y todos los planes incluyen clientes ilimitados y 30 días de prueba.",
    "",
    "## Páginas",
    "",
    ...PUBLIC_PAGES.map((page) => `- [${page.title}](${origin}${page.markdown}): versión en Markdown de ${origin}${page.path === "/" ? "" : page.path}`),
    "",
    ...(plans.length ? ["## Planes", "", ...plans.map(planLine), ""] : []),
    "## Contacto",
    "",
    ...contactLines(operator),
    `- Solicitar una demo o contratar el plan Empresarial: ${operator.whatsappUrl}`,
    ""
  ].join("\n");
}

export function homeMarkdown(plans: PricingPlan[], faq: FaqItem[], operator: LegalOperator = legalOperator()) {
  const origin = siteUrl(operator);
  return [
    `# ${SITE_NAME}: ${SITE_TAGLINE.toLowerCase()}`,
    "",
    SITE_DESCRIPTION,
    "",
    "## Qué ofrece",
    "",
    "- **Tarjetas digitales**: Apple Wallet, Google Wallet y tarjeta web con la identidad del negocio.",
    "- **Programas flexibles**: premia visitas, compras o puntos con recompensas claras.",
    "- **App para el equipo**: escáner de QR y PIN para registrar compras y canjes.",
    "- **Avisos automáticos**: la tarjeta avisa cada compra y cada premio; correos de bienvenida y de premio.",
    "- **Varias sucursales**: control de acceso del equipo y resultados por ubicación.",
    "",
    "## Cómo funciona",
    "",
    "1. Define tu programa: visitas, compras o puntos, y sus recompensas.",
    "2. Invita a tus clientes: se registran con un QR y guardan su tarjeta, sin app ni cuenta.",
    "3. Reconoce cada visita: tu equipo escanea y morrow calcula el avance automáticamente.",
    "",
    ...(plans.length
      ? ["## Planes", "", "Precios en pesos mexicanos más IVA. Clientes ilimitados y 30 días de prueba en todos los planes.", "", ...plans.map(planLine), ""]
      : []),
    "## Preguntas frecuentes",
    "",
    ...faq.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    "## Contacto",
    "",
    ...contactLines(operator),
    "",
    `Más información: [Términos](${origin}/terminos) · [Privacidad](${origin}/privacidad)`,
    ""
  ].join("\n");
}

export function legalMarkdown(path: "/terminos" | "/privacidad" | "/privacidad/clientes", operator: LegalOperator = legalOperator()) {
  if (path === "/terminos") return termsMarkdown(operator);
  if (path === "/privacidad") return privacyMarkdown(operator);
  return customerPrivacyMarkdown(operator);
}

export function homeJsonLd(plans: PricingPlan[], faq: FaqItem[], operator: LegalOperator = legalOperator()) {
  const origin = siteUrl(operator);
  const organizationId = `${origin}/#organization`;
  const sameAs = organizationSameAs();
  const [locality, region] = operator.jurisdiction.split(",").map((part) => part.trim());
  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/icons/icon-512.png`,
    description: SITE_DESCRIPTION,
    telephone: operator.whatsapp,
    ...(operator.privacyEmail ? { email: operator.privacyEmail } : {}),
    address: {
      "@type": "PostalAddress",
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry: "MX"
    },
    areaServed: "MX",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: operator.whatsapp,
      url: operator.whatsappUrl,
      ...(operator.privacyEmail ? { email: operator.privacyEmail } : {}),
      availableLanguage: ["es"]
    },
    ...(sameAs.length ? { sameAs } : {})
  };
  const graph: Array<Record<string, unknown>> = [
    organization,
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: origin,
      name: SITE_NAME,
      inLanguage: "es-MX",
      publisher: { "@id": organizationId }
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${origin}/#software`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE_DESCRIPTION,
      url: origin,
      publisher: { "@id": organizationId },
      ...(plans.length
        ? {
            offers: plans.map((plan) => ({
              "@type": "Offer",
              name: plan.name,
              description: plan.tagline,
              price: (plan.monthlyAmount / 100).toFixed(2),
              priceCurrency: "MXN",
              url: `${origin}/#precios`
            }))
          }
        : {})
    },
    {
      "@type": "FAQPage",
      "@id": `${origin}/#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    }
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}

/** JSON for a <script type="application/ld+json"> without breaking out of the tag. */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function textResponse(body: string, contentType: "text/plain" | "text/markdown") {
  return new Response(body, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      // Markdown is also served at the HTML URLs via Accept rewrites; never
      // let a shared cache store it there and hand it to browsers.
      "Cache-Control": contentType === "text/markdown" ? "private, no-store" : "public, max-age=3600",
      "Vary": "Accept"
    }
  });
}
