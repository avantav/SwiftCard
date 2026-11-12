import { describe, expect, it } from "vitest";
import { DEFAULT_SALES_WHATSAPP_NUMBER, demoRequestLink } from "./demo-request";

describe("demoRequestLink", () => {
  it("opens WhatsApp with a prefilled message by default", () => {
    const link = demoRequestLink({});
    expect(link.external).toBe(true);
    expect(link.href).toBe(
      `https://wa.me/${DEFAULT_SALES_WHATSAPP_NUMBER}?text=Hola%2C%20quiero%20una%20demo%20de%20morrow%20para%20mi%20negocio.`,
    );
  });

  it("accepts a WhatsApp number override with formatting", () => {
    expect(demoRequestLink({ NEXT_PUBLIC_SALES_WHATSAPP_NUMBER: "+52 (662) 000 1111" }).href).toMatch(
      /^https:\/\/wa\.me\/526620001111\?text=/,
    );
  });

  it("prefers an explicit HTTPS demo URL and rejects unsafe ones", () => {
    expect(demoRequestLink({ NEXT_PUBLIC_DEMO_REQUEST_URL: "https://cal.com/morrow/demo" }).href).toBe(
      "https://cal.com/morrow/demo",
    );
    expect(demoRequestLink({ NEXT_PUBLIC_DEMO_REQUEST_URL: "javascript:alert(1)" }).href).toMatch(/^https:\/\/wa\.me\//);
    expect(demoRequestLink({ NEXT_PUBLIC_DEMO_REQUEST_URL: "http://insecure.example.com" }).href).toMatch(/^https:\/\/wa\.me\//);
  });
});
