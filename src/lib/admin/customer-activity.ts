/**
 * Customer activity and corrections for the Admin general (DEC-0074). Pure
 * model: the loader reads with the RLS-scoped session client and the
 * database enforces every rule again (RPCs, triggers and 0081).
 */

export type ProgramType = "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";

export type CorrectionProgram = {
  programType: ProgramType;
  unitSingular: string;
  unitPlural: string;
  allowPurchaseCancellations: boolean;
  allowRewardCancellations: boolean;
  allowRedemptionReversals: boolean;
};

export type CorrectionKind = "cancel-purchase" | "reverse-redemption" | "cancel-reward";

export type ActivityItem =
  | { kind: "purchase"; id: string; at: string; branch: string; amountMinor: number; ticket: string; units: number; status: "CONFIRMED" | "CANCELLED"; note: string | null }
  | { kind: "redemption"; id: string; at: string; branch: string; reward: string; status: "COMPLETED" | "REVERSED"; note: string | null }
  | { kind: "reward"; id: string; at: string; reward: string; status: "AVAILABLE" | "REDEEMED" | "EXPIRED" | "CANCELLED"; expiresAt: string | null; note: string | null }
  | { kind: "adjustment"; id: string; at: string; branch: string; delta: number; note: string };

/** The one correction a movement allows, or null (role is checked by the caller). */
export function correctionFor(item: ActivityItem, program: CorrectionProgram | null): CorrectionKind | null {
  if (!program) return null;
  const lifetime = program.programType === "LIFETIME_POINTS";
  if (item.kind === "purchase") return item.status === "CONFIRMED" && program.allowPurchaseCancellations && !lifetime ? "cancel-purchase" : null;
  if (item.kind === "redemption") return item.status === "COMPLETED" && program.allowRedemptionReversals ? "reverse-redemption" : null;
  if (item.kind === "reward") return item.status === "AVAILABLE" && program.allowRewardCancellations && !lifetime ? "cancel-reward" : null;
  return null;
}

/** Stamp adjustments use the cyclic engine; lifetime points stay definitive. */
export function canAdjustStamps(program: CorrectionProgram | null) {
  return Boolean(program && program.programType !== "LIFETIME_POINTS");
}

export const CORRECTION_LABELS: Record<CorrectionKind, string> = {
  "cancel-purchase": "Cancelar compra",
  "reverse-redemption": "Revertir canje",
  "cancel-reward": "Cancelar premio",
};

/** What happens, in plain words, before confirming (DESIGN_SYSTEM §11). */
export function correctionConsequence(kind: CorrectionKind, item: ActivityItem, program: CorrectionProgram, money: (minor: number) => string) {
  if (kind === "cancel-purchase" && item.kind === "purchase") {
    return `Se cancelará la compra ${item.ticket} de ${money(item.amountMinor)}: se retirarán ${item.units} ${item.units === 1 ? program.unitSingular : program.unitPlural} y los premios que generó y no se han canjeado. La compra queda como cancelada y no se puede editar.`;
  }
  if (kind === "reverse-redemption" && item.kind === "redemption") {
    return `Se revertirá el canje de «${item.reward}»: el premio vuelve a estar disponible para el cliente.`;
  }
  if (kind === "cancel-reward" && item.kind === "reward") {
    return `Se cancelará el premio «${item.reward}». No se devuelven ${program.unitPlural}.`;
  }
  return "";
}

export const MIN_REASON_LENGTH = 5;

export function validateReason(value: FormDataEntryValue | null) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < MIN_REASON_LENGTH || reason.length > 300) {
    return { ok: false as const, error: `Escribe el motivo (de ${MIN_REASON_LENGTH} a 300 caracteres). Queda en la auditoría.` };
  }
  return { ok: true as const, reason };
}

/** Spanish message for each RPC result code. */
export function correctionResultMessage(code: string | null | undefined, errorCode?: string) {
  if (errorCode === "23514") return "Esta corrección está desactivada en el programa de la tarjeta.";
  switch (code) {
    case "DISABLED": return "Esta corrección está desactivada en el programa de la tarjeta.";
    case "HAS_LATER_ACTIVITY": return "No se puede cancelar: el cliente tiene movimientos posteriores a esta compra.";
    case "REWARD_ALREADY_REDEEMED": return "Primero revierte el canje del premio que generó esta compra.";
    case "NEGATIVE_BALANCE": return "El ajuste dejaría el saldo en negativo.";
    case "PROGRAM_PAUSED": return "El programa está pausado: solo se permiten ajustes negativos.";
    case "EXPIRED": return "El premio ya venció.";
    case "INVALID": return "Revisa los datos y el motivo.";
    default: return "No se pudo aplicar la corrección. El movimiento cambió o ya no está disponible.";
  }
}
