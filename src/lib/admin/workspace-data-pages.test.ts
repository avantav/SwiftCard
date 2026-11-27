import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("phase 4: data pages are viewport-contained (DEC-0073)", () => {
  it("splits statistics and location security into URL tabs that keep the filters", () => {
    const insights = read("src/components/insights-view.tsx");
    const security = read("src/components/location-review-view.tsx");
    expect(insights).toContain('param="view"');
    expect(insights).toContain('{view === "visitas" ? <>');
    expect(insights).toContain('<input name="view" type="hidden" value={view} />');
    expect(security).toContain("LOCATION_REVIEW_TABS");
    expect(security).toContain('{view === "mapa" && rows.length ? (');
    expect(read("src/app/admin/security/page.tsx")).toContain("keep={{ from: single(params.from)");
  });

  it("keeps the customers table in one scroll region with fixed pagination", () => {
    const customers = read("src/app/admin/customers/page.tsx");
    expect(customers).toContain('<AdminScrollRegion className="enterprise-table-wrap" label="Directorio de clientes">');
    expect(customers).toContain('has-footer');
    expect(read("src/app/admin/customers/actions.ts")).toContain('"customer_deleted"');
  });

  it("contains every remaining admin page and gives each a loading state", () => {
    for (const page of ["exports", "legal", "imports", "billing"]) {
      expect(read(`src/app/admin/${page}/page.tsx`)).toContain('<main className="enterprise-page admin-workspace">');
    }
    for (const route of ["dashboard", "campaigns", "security", "imports", "billing"]) {
      expect(existsSync(`src/app/admin/${route}/loading.tsx`)).toBe(true);
    }
    expect(read("src/components/admin/workspace-skeleton.tsx")).toContain('aria-busy="true"');
  });
});
