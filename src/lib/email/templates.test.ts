import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  firstName,
  monogram,
  readableTextColor,
  renderRewardEmail,
  renderWelcomeEmail,
  type EmailBrand,
} from "./templates";

const brand: EmailBrand = {
  tenantName: "Clarity Brew Bar",
  logoUrl: "https://project.supabase.co/storage/v1/object/public/wallet-assets/logo.png",
  backgroundColor: "#10253D",
  showMorrowAttribution: true,
};

describe("customer email templates", () => {
  it("welcomes the customer with the welcome reward and next goal", () => {
    const email = renderWelcomeEmail({
      brand,
      customerName: "Ana María López",
      programName: "Club Clarity",
      cardUrl: "https://wallet.example.com/card/token",
      unitNamePlural: "sellos",
      welcomeRewardName: "Café gratis",
      nextRewardText: "Tu próximo premio: Postre. Te faltan 5 sellos.",
    });
    expect(email.subject).toBe("¡Bienvenido! Tienes un regalo en Clarity Brew Bar");
    expect(email.html).toContain("Hola Ana,");
    expect(email.html).toContain("Tu tarjeta está lista");
    expect(email.html).toContain("Regalo de bienvenida");
    expect(email.html).toContain("Café gratis");
    expect(email.text).toContain("Tu regalo de bienvenida: Café gratis.");
    expect(email.html).toContain('href="https://wallet.example.com/card/token"');
    expect(email.html).toContain("Powered by <strong>morrow</strong>");
    expect(email.text).toContain("Abrir mi tarjeta: https://wallet.example.com/card/token");
    expect(email.text).toContain("Tu próximo premio: Postre. Te faltan 5 sellos.");
  });

  it("uses the program subject when there is no welcome reward", () => {
    const email = renderWelcomeEmail({
      brand,
      customerName: "Ana",
      programName: "Club Clarity",
      cardUrl: "https://wallet.example.com/card/token",
      unitNamePlural: "puntos",
      welcomeRewardName: null,
      nextRewardText: null,
    });
    expect(email.subject).toBe("Bienvenido a Club Clarity de Clarity Brew Bar");
    expect(email.html).not.toContain("egalo de bienvenida");
  });

  it("announces one or several unlocked rewards", () => {
    const single = renderRewardEmail({
      brand,
      customerName: "Luis",
      rewardNames: ["Café gratis"],
      cardUrl: "https://wallet.example.com/card/token",
    });
    expect(single.subject).toBe("¡Ganaste Café gratis en Clarity Brew Bar!");
    expect(single.text).toContain("Muéstralo en caja para canjearlo.");

    const several = renderRewardEmail({
      brand,
      customerName: "Luis",
      rewardNames: ["Postre", "Comida para dos"],
      cardUrl: "https://wallet.example.com/card/token",
    });
    expect(several.subject).toBe("¡Ganaste 2 premios en Clarity Brew Bar!");
    expect(several.html).toContain("Ganaste 2 premios");
    expect(several.html).toContain(">Postre</p>");
    expect(several.html).toContain(">Comida para dos</p>");
    expect(several.text).toContain("ganaste: Postre y Comida para dos.");
  });

  it("escapes every dynamic value and drops unsafe links and images", () => {
    const email = renderRewardEmail({
      brand: { ...brand, tenantName: '<script>alert("x")</script>', logoUrl: "javascript:alert(1)" },
      customerName: '<img src=x onerror="alert(1)">',
      rewardNames: ["<b>Premio</b>"],
      cardUrl: "http://insecure.example.com/card/token",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Premio</b>");
    expect(email.html).not.toContain("javascript:");
    expect(email.html).not.toContain('href="http://insecure');
    expect(email.html).toContain("&lt;b&gt;Premio&lt;/b&gt;");
  });

  it("omits the morrow attribution for white-label tenants", () => {
    const email = renderRewardEmail({
      brand: { ...brand, showMorrowAttribution: false },
      customerName: "Luis",
      rewardNames: ["Café"],
      cardUrl: "https://wallet.example.com/card/token",
    });
    expect(email.html).not.toContain("morrow");
  });

  it("picks an accessible button text color for the brand background", () => {
    expect(readableTextColor("#10253D")).toBe("#FFFFFF");
    expect(readableTextColor("#F5E6A8")).toBe("#111827");
    expect(readableTextColor("not-a-color")).toBe("#FFFFFF");
  });

  it("escapes HTML and extracts a first name", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(firstName("  María   José  ")).toBe("María");
  });

  it("uses initials in the brand tile when the card has no logo", () => {
    expect(monogram("Casa Garmendia")).toBe("CG");
    expect(monogram("  café   norte de la ciudad ")).toBe("CN");
    expect(monogram("¡Ñandú!")).toBe("Ñ");
    const email = renderRewardEmail({
      brand: { ...brand, logoUrl: null },
      customerName: "Luis",
      rewardNames: ["Café gratis"],
      cardUrl: "https://wallet.example.com/card/token",
    });
    expect(email.html).toContain(">CB</span>");
    expect(email.html).not.toContain("<img");
  });
});
