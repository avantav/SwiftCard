import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const page = source("../../app/page.tsx");
const styles = source("../../app/landing.css");
const motion = source("../../components/landing-motion.tsx");

describe("public landing page", () => {
  it("teaches the product before asking for a demo", () => {
    expect(page).toContain("Haz que cada visita se convierta en");
    expect(page).toContain("crecimiento.");
    expect(page).toContain('id="como-funciona"');
    expect(page).toContain('id="producto"');
    expect(page).toContain('id="beneficios"');
    expect(page).toContain('id="preguntas"');
    expect(page).toContain('id="solicitar-demo"');
    expect(page).toContain("No crean una cuenta ni descargan una app.");
  });

  it("uses demo requests as the primary conversion without implying checkout", () => {
    expect(page.match(/Solicitar una demo/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("Sin tarjeta de crédito");
    expect(page).toContain("sin pedir pagos en línea");
    expect(page.toLowerCase()).not.toContain("stripe");
    expect(page).not.toContain("Comprar ahora");
    expect(page).toContain("NEXT_PUBLIC_DEMO_REQUEST_URL");
  });

  it("retains staff routing and a secondary login path", () => {
    expect(page).toContain('redirect("/change-password")');
    expect(page).toContain("getDefaultInternalRoute");
    expect(page).toContain('href="/login"');
  });

  it("provides responsive layouts and accessible interaction targets", () => {
    expect(styles).toContain(".mkt-page");
    expect(styles).toContain(".mkt-button");
    expect(styles).toMatch(/\.mkt-button \{[\s\S]*?min-height: 44px;/);
    expect(styles).toContain("@media (max-width: 1023px)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(page).toContain('aria-label="Navegación principal"');
    expect(page).toContain("<details");
  });

  it("uses progressive motion to explain the loyalty flow and honors reduced motion", () => {
    expect(page).toContain("LandingMotion");
    expect(page).toContain("mkt-dashboard");
    expect(page).toContain("mkt-wallet-card");
    expect(page).toContain("mkt-phone");
    expect(page).toContain("data-landing-reveal");
    expect(motion).toContain("IntersectionObserver");
    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("@keyframes mkt-dashboard-float");
    expect(styles).toContain("@keyframes mkt-phone-float");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.mkt-dashboard/);
  });

  it("uses the documented editorial marketing language without gradients", () => {
    expect(styles).toContain("--mkt-navy: #10253d");
    expect(styles).toContain("font-family: Georgia");
    expect(styles).toContain("border-radius: 28px");
    expect(styles).not.toContain("linear-gradient");
    expect(styles).not.toContain("backdrop-filter");
  });
});
