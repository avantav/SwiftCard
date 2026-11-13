/**
 * Retention dashboard (DEC-0067): filters, segment copy and chart shaping.
 * The RPC app.get_customer_insights is the authority for every number.
 */

export const SEGMENTS = ["NEW", "FREQUENT", "OCCASIONAL", "ONE_VISIT", "AT_RISK", "LOST", "NEVER_PURCHASED"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_COPY: Record<Segment, { label: string; rule: string; action: string }> = {
  NEW: { label: "Nuevos", rule: "Se registraron en los últimos 30 días.", action: "Dales una razón para volver pronto." },
  FREQUENT: { label: "Frecuentes", rule: "4 o más compras y vinieron en los últimos 30 días.", action: "Tus mejores clientes: reconócelos." },
  OCCASIONAL: { label: "Ocasionales", rule: "2 o 3 compras y vinieron en los últimos 30 días.", action: "Están formando el hábito." },
  ONE_VISIT: { label: "Una sola visita", rule: "Solo 1 compra en los últimos 60 días.", action: "Invítalos a una segunda visita." },
  AT_RISK: { label: "En riesgo", rule: "Ya habían vuelto, pero llevan de 31 a 60 días sin venir.", action: "Recupéralos antes de perderlos." },
  LOST: { label: "Perdidos", rule: "Más de 60 días sin venir.", action: "Necesitan un buen motivo para regresar." },
  NEVER_PURCHASED: { label: "Nunca compraron", rule: "Se registraron hace más de 30 días y no han comprado.", action: "Recuérdales su tarjeta." }
};

export const PERIOD_PRESETS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;
export const MAX_INSIGHT_DAYS = 366;

export type InsightsFilters = { from: string; to: string; preset: number | null; branchId: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBefore(day: string, days: number) {
  return isoDay(new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000));
}

/** `today` is the tenant's calendar day (YYYY-MM-DD). */
export function parseInsightsFilters(params: Record<string, string | string[] | undefined>, today: string): InsightsFilters {
  const branch = single(params.branch) ?? "";
  const branchId = UUID.test(branch) ? branch : null;
  const preset = Number(single(params.period));
  if ((PERIOD_PRESETS as readonly number[]).includes(preset)) {
    return { from: daysBefore(today, preset - 1), to: today, preset, branchId };
  }
  const from = single(params.from) ?? "";
  const to = single(params.to) ?? "";
  if (DATE.test(from) && DATE.test(to) && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to))) {
    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
    if (span >= 1 && span <= MAX_INSIGHT_DAYS) return { from, to, preset: null, branchId };
  }
  return { from: daysBefore(today, DEFAULT_DAYS - 1), to: today, preset: DEFAULT_DAYS, branchId };
}

/** Calendar day in a time zone, e.g. the tenant's "today". */
export function dayInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type PeriodTotals = {
  active_customers: number;
  returning_customers: number;
  purchases: number;
  revenue_minor: number;
  new_customers: number;
};

type InsightsBase = {
  role: "ADMIN" | "MANAGER";
  timezone: string;
  period: { from: string; to: string; days: number };
  summary: PeriodTotals;
  previous: PeriodTotals;
  rewards: { generated: number; redeemed: number; pending: number };
};

/** Without the Empresarial plan only the summary and rewards are returned (DEC-0069). */
export type BasicCustomerInsights = InsightsBase & { advanced: false };

export type AdvancedCustomerInsights = InsightsBase & {
  advanced: true;
  segments: Array<{ segment: Segment; customers: number; spend_minor: number }>;
  funnel: { registered: number; purchased_1: number; purchased_2: number; purchased_3: number };
  weekly: Array<{ week_start: string; new_visits: number; returning_visits: number }>;
  heatmap: Array<{ dow: number; hour: number; visits: number }>;
  top_customers: Array<{ customer_id: string; full_name: string; visits: number; spend_minor: number }>;
  branches: Array<{ branch_id: string; branch_name: string; active_customers: number; returning_customers: number; purchases: number; revenue_minor: number }>;
};

export type CustomerInsights = BasicCustomerInsights | AdvancedCustomerInsights;

export function ratio(part: number, total: number) {
  return total > 0 ? part / total : null;
}

export function returnRate(totals: PeriodTotals) {
  return ratio(totals.returning_customers, totals.active_customers);
}

export function averageTicket(totals: PeriodTotals) {
  return totals.purchases > 0 ? Math.round(totals.revenue_minor / totals.purchases) : null;
}

export function formatPercent(value: number | null, digits = 0) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

/**
 * Change against the previous period. Only shown when the previous period has
 * data (DESIGN_SYSTEM §14: no invented trends). Rates compare in points.
 */
export function describeChange(current: number | null, previous: number | null, kind: "count" | "rate") {
  if (current === null || previous === null || (kind === "count" && previous === 0)) return null;
  const delta = kind === "rate" ? (current - previous) * 100 : ((current - previous) / previous) * 100;
  const rounded = Math.round(delta);
  if (rounded === 0) return { direction: "flat" as const, text: "Sin cambio vs. periodo anterior" };
  const unit = kind === "rate" ? (Math.abs(rounded) === 1 ? " punto" : " puntos") : "%";
  return {
    direction: rounded > 0 ? ("up" as const) : ("down" as const),
    text: `${rounded > 0 ? "Sube" : "Baja"} ${Math.abs(rounded)}${unit} vs. periodo anterior`
  };
}

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** Rows Monday..Sunday, columns only for the hours that had visits (contiguous). */
export function heatmapGrid(cells: AdvancedCustomerInsights["heatmap"]) {
  if (!cells.length) return { hours: [] as number[], rows: [] as Array<{ day: string; values: number[] }>, max: 0 };
  const minHour = Math.min(...cells.map((cell) => cell.hour));
  const maxHour = Math.max(...cells.map((cell) => cell.hour));
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, index) => minHour + index);
  const lookup = new Map(cells.map((cell) => [`${cell.dow}:${cell.hour}`, Number(cell.visits)]));
  const rows = WEEKDAYS.map((day, index) => ({
    day,
    values: hours.map((hour) => lookup.get(`${index + 1}:${hour}`) ?? 0)
  }));
  return { hours, rows, max: Math.max(...cells.map((cell) => Number(cell.visits))) };
}

export function busiestSlot(cells: AdvancedCustomerInsights["heatmap"]) {
  const top = [...cells].sort((a, b) => Number(b.visits) - Number(a.visits))[0];
  return top ? `${WEEKDAYS[top.dow - 1]} de ${top.hour}:00 a ${top.hour + 1}:00` : null;
}

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && (SEGMENTS as readonly string[]).includes(value);
}
