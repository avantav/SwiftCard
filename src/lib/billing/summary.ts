export type BillingUsageLevel = "UNLIMITED" | "AVAILABLE" | "WARNING" | "CRITICAL" | "LIMIT";

export function getBillingUsageState(peak: number, limit: number | null) {
  if (limit === null) return { level: "UNLIMITED" as const, percent: null, visualPercent: 0 };
  const percent = Math.round((peak / limit) * 100);
  const level: BillingUsageLevel = percent >= 100
    ? "LIMIT"
    : percent >= 90
      ? "CRITICAL"
      : percent >= 80
        ? "WARNING"
        : "AVAILABLE";
  return { level, percent, visualPercent: Math.min(100, Math.max(0, percent)) };
}

export function billingSubscriptionLabel(status: string) {
  return ({
    TRIALING: "En prueba",
    INCOMPLETE: "Incompleta",
    ACTIVE: "Activa",
    PAST_DUE: "Pago vencido",
    PAUSED: "Pausada",
    CANCELED: "Cancelada"
  } as Record<string, string>)[status] ?? status;
}

export function billingSubscriptionBadge(status: string) {
  if (status === "ACTIVE" || status === "TRIALING") return "is-active";
  if (status === "PAST_DUE" || status === "CANCELED") return "is-suspended";
  return "is-neutral";
}
