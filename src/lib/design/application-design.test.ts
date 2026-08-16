import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const adminLayout = source("../../app/admin/layout.tsx");
const operationsLayout = source("../../app/app/layout.tsx");
const adminNavigation = source("../../components/admin-navigation.tsx");
const operationsNavigation = source("../../components/operations-navigation.tsx");
const styles = source("../../app/globals.css");

const adminPages = ["page.tsx", "branches/page.tsx", "staff/page.tsx", "cards/page.tsx", "cards/[cardId]/edit/page.tsx", "dashboard/page.tsx", "exports/page.tsx"].map((path) => source(`../../app/admin/${path}`));
const operationsPages = ["page.tsx", "scan/page.tsx", "program/page.tsx", "purchase/page.tsx", "redeem/page.tsx"].map((path) => source(`../../app/app/${path}`));
const publicPages = ["../../app/page.tsx", "../../app/login/page.tsx", "../../app/change-password/page.tsx", "../../app/register/[branchToken]/page.tsx"].map(source);

describe("application-wide design contract", () => {
  it("uses protected shared shells and role-aware navigation", () => {
    expect(adminLayout).toContain('requireInternalArea("ADMIN")');
    expect(adminLayout).toContain("AdminNavigation");
    expect(operationsLayout).toContain('requireInternalArea("APP", { allowLockedShared: true })');
    expect(operationsLayout).toContain("OperationsNavigation");
    expect(operationsLayout).toContain("PwaController");
    expect(adminNavigation).toContain('role === "ADMIN"');
    expect(adminNavigation).toContain('/admin/cards');
    expect(operationsNavigation).toContain('aria-label="Navegación operativa"');
    expect(operationsNavigation).toContain("Salir");
  });

  it("moves every authenticated page into its standard hierarchy", () => {
    for (const page of adminPages) {
      expect(page).toContain('className="enterprise-page');
      expect(page).not.toContain('className="shell"');
    }
    for (const page of operationsPages) {
      expect(page).toContain('className="operations-page"');
      expect(page).not.toContain('className="shell');
    }
  });

  it("uses the shared public composition and a branded Web Card", () => {
    for (const page of publicPages) expect(page).toContain("public-");
    const cardPage = source("../../app/card/[cardToken]/page.tsx");
    const card = source("../../components/public-wallet-card.tsx");
    expect(cardPage).toContain("PublicWalletCard");
    expect(card).toContain('className="wallet-shell"');
    expect(card).toContain("--card-primary");
    expect(card).toContain("MAX_VISIBLE_STAMPS");
    expect(card).toContain('className="wallet-stamp-grid"');
    expect(card).toContain("wallet-stamp-logo");
    expect(card).toContain("sellos acumulados");
    expect(styles).toContain(".wallet-stamp.is-filled");
    expect(card).toContain("Powered by SwiftWallet");
  });

  it("covers pending, success, error, empty and destructive confirmation states", () => {
    const purchase = source("../../app/app/purchase/page.tsx");
    const redeem = source("../../app/app/redeem/page.tsx");
    expect(purchase).toContain("SubmitButton");
    expect(purchase).toContain("is-success");
    expect(purchase).toContain("is-error");
    expect(redeem).toContain("operations-empty-state");
    expect(source("../../components/tenant-status-form.tsx")).toContain("window.confirm");
  });

  it("uses mandatory tokens and responsive patterns without prohibited decoration", () => {
    expect(styles).toContain("--enterprise-sidebar: #0c1618");
    expect(styles).toContain("--enterprise-focus: #2563eb");
    expect(styles).toContain("operations-bottom-nav");
    expect(styles).toContain("@media (max-width: 639px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).not.toContain("linear-gradient");
    expect(styles).not.toContain("backdrop-filter");
  });
});
