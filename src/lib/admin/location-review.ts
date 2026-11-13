/**
 * Purchase location security view (DEC-0066): filter parsing, labels and
 * review signals. The RPC app.get_purchase_location_review is the authority;
 * these helpers only shape what it returns.
 */

export const LOCATION_RESULTS = ["INSIDE", "OUTSIDE", "NO_COORDINATES", "NO_BRANCH_POINT"] as const;
export type LocationResult = (typeof LOCATION_RESULTS)[number];

export const MAX_REVIEW_DAYS = 93;
const DEFAULT_REVIEW_DAYS = 7;
/** Outside-radius purchases by one operator in the period that warrant review. */
export const REPEATED_OUTSIDE_THRESHOLD = 3;

export type LocationReviewRow = {
  purchase_id: string;
  occurred_at: string;
  purchase_status: string;
  branch_id: string;
  branch_name: string;
  operator_key: string;
  operator_name: string | null;
  operator_kind: "STAFF" | "PIN";
  ticket_number: string;
  amount_minor: number;
  latitude: number | null;
  longitude: number | null;
  branch_latitude: number | null;
  branch_longitude: number | null;
  geofence_radius_meters: number;
  distance_meters: number | null;
  location_result: LocationResult;
};

export type LocationReviewFilters = {
  from: string;
  to: string;
  branchId: string | null;
  operatorKey: string | null;
  result: LocationResult | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Dates are calendar days (YYYY-MM-DD, `to` inclusive) interpreted by the RPC
 * in the tenant's time zone. Invalid input falls back to the last 7 days.
 */
export function parseLocationReviewFilters(
  params: Record<string, string | string[] | undefined>,
  today = new Date()
): LocationReviewFilters {
  const defaultTo = isoDate(today);
  const defaultFrom = isoDate(new Date(today.getTime() - (DEFAULT_REVIEW_DAYS - 1) * 86_400_000));
  let from = single(params.from) ?? "";
  let to = single(params.to) ?? "";
  if (!DATE.test(from) || Number.isNaN(Date.parse(from))) from = defaultFrom;
  if (!DATE.test(to) || Number.isNaN(Date.parse(to))) to = defaultTo;
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (span < 1 || span > MAX_REVIEW_DAYS) {
    from = defaultFrom;
    to = defaultTo;
  }

  const branch = single(params.branch) ?? "";
  const operator = single(params.operator) ?? "";
  const result = single(params.result) ?? "";
  return {
    from,
    to,
    branchId: UUID.test(branch) ? branch : null,
    operatorKey: /^(staff|pin):[0-9a-f-]{36}$/i.test(operator) && UUID.test(operator.split(":")[1] ?? "") ? operator : null,
    result: (LOCATION_RESULTS as readonly string[]).includes(result) ? (result as LocationResult) : null,
  };
}

export const RESULT_LABELS: Record<LocationResult, string> = {
  INSIDE: "Dentro del radio",
  OUTSIDE: "Fuera del radio",
  NO_COORDINATES: "Sin coordenadas",
  NO_BRANCH_POINT: "Sucursal sin punto",
};

/** Badge variant per state; the label always carries the meaning too. */
export const RESULT_BADGES: Record<LocationResult, string> = {
  INSIDE: "is-active",
  OUTSIDE: "is-error",
  NO_COORDINATES: "is-suspended",
  NO_BRANCH_POINT: "is-neutral",
};

export function summarizeLocationReview(rows: LocationReviewRow[]) {
  const counts = { INSIDE: 0, OUTSIDE: 0, NO_COORDINATES: 0, NO_BRANCH_POINT: 0 } satisfies Record<LocationResult, number>;
  for (const row of rows) counts[row.location_result] += 1;
  return { total: rows.length, ...counts };
}

export type ReviewSignal = { key: string; title: string; detail: string };

/**
 * Patterns that warrant a human look, never automatic action: one operator
 * with repeated outside-radius purchases, and branches whose purchases often
 * arrive without coordinates or that have no configured point.
 */
export function reviewSignals(rows: LocationReviewRow[]): ReviewSignal[] {
  const signals: ReviewSignal[] = [];
  const outsideByOperator = new Map<string, { name: string; count: number; farthest: number }>();
  const missingByBranch = new Map<string, { name: string; count: number; total: number }>();
  const branchesWithoutPoint = new Map<string, string>();

  for (const row of rows) {
    if (row.location_result === "OUTSIDE") {
      const current = outsideByOperator.get(row.operator_key) ?? { name: operatorLabel(row), count: 0, farthest: 0 };
      current.count += 1;
      current.farthest = Math.max(current.farthest, row.distance_meters ?? 0);
      outsideByOperator.set(row.operator_key, current);
    }
    const branch = missingByBranch.get(row.branch_id) ?? { name: row.branch_name, count: 0, total: 0 };
    branch.total += 1;
    if (row.location_result === "NO_COORDINATES") branch.count += 1;
    missingByBranch.set(row.branch_id, branch);
    if (row.location_result === "NO_BRANCH_POINT") branchesWithoutPoint.set(row.branch_id, row.branch_name);
  }

  for (const [key, value] of outsideByOperator) {
    if (value.count >= REPEATED_OUTSIDE_THRESHOLD) {
      signals.push({
        key: `operator:${key}`,
        title: `${value.name}: ${value.count} compras fuera del radio`,
        detail: `La más lejana a ${formatDistance(value.farthest)} de la sucursal.`,
      });
    }
  }
  for (const [key, value] of missingByBranch) {
    if (value.count >= REPEATED_OUTSIDE_THRESHOLD && value.count / value.total >= 0.25) {
      signals.push({
        key: `missing:${key}`,
        title: `${value.name}: ${value.count} compras sin coordenadas`,
        detail: `${Math.round((value.count / value.total) * 100)}% de sus compras del periodo.`,
      });
    }
  }
  for (const [key, name] of branchesWithoutPoint) {
    signals.push({
      key: `nopoint:${key}`,
      title: `${name} no tiene punto configurado`,
      detail: "Configura su ubicación en Sucursales para poder comparar distancias.",
    });
  }
  return signals;
}

export function operatorLabel(row: Pick<LocationReviewRow, "operator_name" | "operator_kind">) {
  const name = row.operator_name?.trim() || "Operador sin nombre";
  return row.operator_kind === "PIN" ? `${name} (PIN)` : name;
}

export function formatDistance(meters: number | null) {
  if (meters === null) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export function operatorOptions(rows: LocationReviewRow[], selected: string | null) {
  const options = new Map<string, string>();
  for (const row of rows) options.set(row.operator_key, operatorLabel(row));
  if (selected && !options.has(selected)) options.set(selected, "Operador seleccionado");
  return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}
