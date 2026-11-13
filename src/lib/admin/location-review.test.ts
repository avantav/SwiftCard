import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatDistance,
  operatorLabel,
  operatorOptions,
  parseLocationReviewFilters,
  reviewSignals,
  summarizeLocationReview,
  type LocationReviewRow
} from "./location-review";

const STAFF = "staff:74000000-0000-0000-0000-000000000013";
const BRANCH = "74000000-0000-0000-0000-0000000000b1";

function row(overrides: Partial<LocationReviewRow> = {}): LocationReviewRow {
  return {
    purchase_id: crypto.randomUUID(),
    occurred_at: "2026-11-13T18:00:00Z",
    purchase_status: "CONFIRMED",
    branch_id: BRANCH,
    branch_name: "Centro",
    operator_key: STAFF,
    operator_name: "Ana",
    operator_kind: "STAFF",
    ticket_number: "T-1",
    amount_minor: 10000,
    latitude: 29.07,
    longitude: -110.95,
    branch_latitude: 29.07,
    branch_longitude: -110.95,
    geofence_radius_meters: 100,
    distance_meters: 10,
    location_result: "INSIDE",
    ...overrides
  };
}

describe("parseLocationReviewFilters", () => {
  const today = new Date("2026-11-13T12:00:00Z");

  it("defaults to the last 7 days", () => {
    expect(parseLocationReviewFilters({}, today)).toEqual({ from: "2026-11-07", to: "2026-11-13", branchId: null, operatorKey: null, result: null });
  });

  it("keeps valid filters and drops invalid ones", () => {
    expect(parseLocationReviewFilters({ from: "2026-10-01", to: "2026-10-31", branch: BRANCH, operator: STAFF, result: "OUTSIDE" }, today))
      .toEqual({ from: "2026-10-01", to: "2026-10-31", branchId: BRANCH, operatorKey: STAFF, result: "OUTSIDE" });
    expect(parseLocationReviewFilters({ branch: "x", operator: "staff:nope", result: "ANY" }, today))
      .toMatchObject({ branchId: null, operatorKey: null, result: null });
  });

  it("rejects reversed or longer than 93-day periods", () => {
    expect(parseLocationReviewFilters({ from: "2026-11-10", to: "2026-11-01" }, today)).toMatchObject({ from: "2026-11-07", to: "2026-11-13" });
    expect(parseLocationReviewFilters({ from: "2026-01-01", to: "2026-11-01" }, today)).toMatchObject({ from: "2026-11-07", to: "2026-11-13" });
    expect(parseLocationReviewFilters({ from: "2026-08-13", to: "2026-11-13" }, today)).toMatchObject({ from: "2026-08-13", to: "2026-11-13" });
  });
});

describe("summaries and review signals", () => {
  it("counts every location state", () => {
    expect(summarizeLocationReview([row(), row({ location_result: "OUTSIDE" }), row({ location_result: "NO_COORDINATES" })]))
      .toEqual({ total: 3, INSIDE: 1, OUTSIDE: 1, NO_COORDINATES: 1, NO_BRANCH_POINT: 0 });
  });

  it("flags repeated outside purchases, frequent missing coordinates and branches without a point", () => {
    const rows = [
      ...[1200, 300, 800].map((distance) => row({ location_result: "OUTSIDE", distance_meters: distance })),
      ...[1, 2, 3].map(() => row({ location_result: "NO_COORDINATES", latitude: null, longitude: null, distance_meters: null })),
      row({ branch_id: "b2", branch_name: "Norte", location_result: "NO_BRANCH_POINT" })
    ];
    const signals = reviewSignals(rows);
    expect(signals.map((signal) => signal.title)).toEqual([
      "Ana: 3 compras fuera del radio",
      "Centro: 3 compras sin coordenadas",
      "Norte no tiene punto configurado"
    ]);
    expect(signals[0]!.detail).toContain("1.2 km");
  });

  it("stays quiet below the threshold", () => {
    expect(reviewSignals([row({ location_result: "OUTSIDE", distance_meters: 500 }), row()])).toEqual([]);
  });
});

describe("labels", () => {
  it("formats operators, distances and filter options", () => {
    expect(operatorLabel({ operator_name: "Luis", operator_kind: "PIN" })).toBe("Luis (PIN)");
    expect(operatorLabel({ operator_name: null, operator_kind: "STAFF" })).toBe("Operador sin nombre");
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(85)).toBe("85 m");
    expect(formatDistance(1530)).toBe("1.5 km");
    expect(operatorOptions([row(), row()], null)).toEqual([{ value: STAFF, label: "Ana" }]);
  });
});

describe("security view boundaries", () => {
  const page = readFileSync(new URL("../../app/admin/security/page.tsx", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("../../components/admin-navigation.tsx", import.meta.url), "utf8");

  it("reads purchases only through the audited, role-checked RPC", () => {
    expect(page).toContain('rpc("get_purchase_location_review"');
    expect(page).not.toContain('from("purchases")');
    expect(page).toContain('requireInternalArea("ADMIN")');
  });

  it("is listed for administrators, also in support mode (DEC-0071)", () => {
    expect(navigation).toContain('href: "/admin/security"');
    expect(page).toContain("supportReadParams(context)");
  });
});
