import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const page = source("../../app/page.tsx");
const styles = source("../../app/globals.css");
const motion = source("../../components/landing-motion.tsx");

describe("public landing page", () => {
  it("teaches the product before asking for a demo", () => {
    expect(page).toContain("Convierte cada compra en una");
    expect(page).toContain("razón para volver.");
    expect(page).toContain('id="como-funciona"');
    expect(page).toContain('id="beneficios"');
    expect(page).toContain('id="preguntas"');
    expect(page).toContain('id="solicitar-demo"');
    expect(page).toContain("No necesitan usuario ni contraseña.");
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
    expect(styles).toContain(".landing-page");
    expect(styles).toContain(".landing-button");
    expect(styles).toMatch(/\.landing-button \{[\s\S]*?min-height: 46px;/);
    expect(styles).toContain("@media (max-width: 1023px)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(page).toContain('aria-label="Navegación principal"');
    expect(page).toContain("<details");
  });

  it("uses progressive motion to explain the loyalty flow and honors reduced motion", () => {
    expect(page).toContain("LandingMotion");
    expect(page).toContain("Flujo: compra, progreso y premio");
    expect(page).toContain("data-landing-reveal");
    expect(motion).toContain("IntersectionObserver");
    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("@keyframes landing-card-scan");
    expect(styles).toContain("@keyframes landing-flow-step");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.landing-product-preview/);
  });
});
