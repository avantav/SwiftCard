/** Sales WhatsApp for demo requests (public business contact, not a secret). */
export const DEFAULT_SALES_WHATSAPP_NUMBER = "526621711274";
export const DEMO_REQUEST_MESSAGE = "Hola, quiero una demo de morrow para mi negocio.";

export type DemoRequestLink = { href: string; external: boolean };
type LinkEnv = Record<string, string | undefined>;

function defaultEnv(): LinkEnv {
  return {
    NEXT_PUBLIC_DEMO_REQUEST_URL: process.env.NEXT_PUBLIC_DEMO_REQUEST_URL,
    NEXT_PUBLIC_SALES_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_SALES_WHATSAPP_NUMBER,
  };
}

/** WhatsApp chat with the sales number and a prefilled message. */
export function salesWhatsAppLink(message: string, env: LinkEnv = defaultEnv()): DemoRequestLink {
  const override = env.NEXT_PUBLIC_SALES_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
  const number = /^\d{10,15}$/.test(override) ? override : DEFAULT_SALES_WHATSAPP_NUMBER;
  return {
    href: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    external: true,
  };
}

/**
 * Demo CTA destination. An explicit NEXT_PUBLIC_DEMO_REQUEST_URL (https only)
 * wins; otherwise a WhatsApp chat with a prefilled message. The number can be
 * overridden with NEXT_PUBLIC_SALES_WHATSAPP_NUMBER (digits with country code).
 */
export function demoRequestLink(env: LinkEnv = defaultEnv()): DemoRequestLink {
  const configured = env.NEXT_PUBLIC_DEMO_REQUEST_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:") return { href: url.toString(), external: true };
    } catch {
      // Fall back to WhatsApp below.
    }
  }
  return salesWhatsAppLink(DEMO_REQUEST_MESSAGE, env);
}
