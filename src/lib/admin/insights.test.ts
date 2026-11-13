import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  averageTicket,
  busiestSlot,
  dayInTimeZone,
  describeChange,
  formatPercent,
  heatmapGrid,
  isSegment,
  parseInsightsFilters,
  returnRate,
  SEGMENT_COPY,
  SEGMENTS
} from "./insights";

const BRANCH = "75000000-0000-0000-0000-0000000000b1";

describe("parseInsightsFilters", () => {
  it("defaults to the last 30 days of the tenant's calendar", () => {
    expect(parseInsightsFilters({}, "2026-11-13")).toEqual({ from: "2026-10-15", to: "2026-11-13", preset: 30, branchId: null });
  });

  it("supports presets, custom ranges and a valid branch", () => {
    expect(parseInsightsFilters({ period: "7", branch: BRANCH }, "2026-11-13")).toEqual({ from: "2026-11-07", to: "2026-11-13", preset: 7, branchId: BRANCH });
    expect(parseInsightsFilters({ from: "2026-01-01", to: "2026-03-31" }, "2026-11-13")).toMatchObject({ from: "2026-01-01", to: "2026-03-31", preset: null });
  });

  it("falls back on reversed, too long or malformed ranges", () => {
    for (const params of [{ from: "2026-05-01", to: "2026-04-01" }, { from: "2024-01-01", to: "2026-01-01" }, { from: "x", to: "y" }, { period: "45" }]) {
      expect(parseInsightsFilters(params, "2026-11-13")).toMatchObject({ preset: 30 });
    }
    expect(parseInsightsFilters({ branch: "nope" }, "2026-11-13").branchId).toBeNull();
  });

  it("computes the tenant day in its time zone", () => {
    expect(dayInTimeZone(new Date("2026-11-14T05:30:00Z"), "America/Mazatlan")).toBe("2026-11-13");
  });
});

describe("metrics", () => {
  const totals = { active_customers: 40, returning_customers: 10, purchases: 50, revenue_minor: 1_000_000, new_customers: 8 };

  it("computes return rate and average ticket", () => {
    expect(returnRate(totals)).toBe(0.25);
    expect(formatPercent(returnRate(totals))).toBe("25%");
    expect(averageTicket(totals)).toBe(20_000);
    expect(returnRate({ ...totals, active_customers: 0 })).toBeNull();
    expect(averageTicket({ ...totals, purchases: 0 })).toBeNull();
  });

  it("never invents a trend without a previous period", () => {
    expect(describeChange(10, 0, "count")).toBeNull();
    expect(describeChange(null, 5, "count")).toBeNull();
    expect(describeChange(12, 10, "count")).toEqual({ direction: "up", text: "Sube 20% vs. periodo anterior" });
    expect(describeChange(0.3, 0.35, "rate")).toEqual({ direction: "down", text: "Baja 5 puntos vs. periodo anterior" });
    expect(describeChange(0.3, 0.301, "rate")).toEqual({ direction: "flat", text: "Sin cambio vs. periodo anterior" });
  });
});

describe("heatmap", () => {
  it("builds Monday-to-Sunday rows over the active hours", () => {
    const grid = heatmapGrid([{ dow: 1, hour: 9, visits: 2 }, { dow: 7, hour: 11, visits: 5 }]);
    expect(grid.hours).toEqual([9, 10, 11]);
    expect(grid.rows[0]).toEqual({ day: "Lun", values: [2, 0, 0] });
    expect(grid.rows[6]).toEqual({ day: "Dom", values: [0, 0, 5] });
    expect(grid.max).toBe(5);
    expect(busiestSlot([{ dow: 1, hour: 9, visits: 2 }, { dow: 5, hour: 18, visits: 9 }])).toBe("Vie de 18:00 a 19:00");
    expect(heatmapGrid([])).toEqual({ hours: [], rows: [], max: 0 });
  });
});

describe("segments", () => {
  it("documents every segment returned by the database", () => {
    const migration = readFileSync(new URL("../../../supabase/migrations/0075_customer_insights.sql", import.meta.url), "utf8");
    for (const segment of SEGMENTS) {
      expect(migration).toContain(`'${segment}'`);
      expect(SEGMENT_COPY[segment].label.length).toBeGreaterThan(0);
    }
    expect(isSegment("AT_RISK")).toBe(true);
    expect(isSegment("VIP")).toBe(false);
  });

  it("keeps customer lists for the general administrator", () => {
    const page = readFileSync(new URL("../../app/admin/dashboard/segmentos/[segment]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain('context.access.role !== "ADMIN"');
    expect(page).toContain('rpc("get_customer_segment_members"');
    expect(page).toContain('rpc("current_tenant_empresarial_available", supportReadParams(context))');
  });
});

describe("Empresarial gating (DEC-0069)", () => {
  it("renders only summary, rewards and the plan notice without Empresarial", () => {
    const view = readFileSync(new URL("../../components/insights-view.tsx", import.meta.url), "utf8");
    expect(view).toContain("insights.advanced");
    expect(view).toContain("BasicInsightsBody");
    const migration = readFileSync(new URL("../../../supabase/migrations/0077_empresarial_advanced_statistics.sql", import.meta.url), "utf8");
    expect(migration).toContain("- 'segments' - 'funnel' - 'weekly' - 'heatmap' - 'top_customers' - 'branches'");
  });
});
