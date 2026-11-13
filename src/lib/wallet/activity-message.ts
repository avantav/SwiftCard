/**
 * Fixed (MVP) Wallet activity messages. Templates are system-defined; per-card
 * editable templates are post-MVP (see docs/WALLET_ACTIVITY_MESSAGES.md).
 * Messages are shown on lock screens, so they never include customer names or
 * contact details.
 */

export const WALLET_ACTIVITY_MESSAGE_MAX_LENGTH = 150;
export const WALLET_ACTIVITY_TITLE_MAX_LENGTH = 40;
export const WALLET_ACTIVITY_EMPTY_MESSAGE = "Aquí verás tu última compra y tus premios.";

export type WalletActivity =
  | { kind: "NONE" }
  | {
      kind: "PURCHASE";
      id: string;
      occurredAt: string;
      /** Units added by the purchase; may be fractional for lifetime points. */
      unitsAwarded: number;
      unlockedRewardNames: string[];
    }
  | {
      kind: "REDEMPTION";
      id: string;
      occurredAt: string;
      rewardName: string;
    }
  | {
      /** Business message from an Empresarial campaign (DEC-0068). */
      kind: "CAMPAIGN";
      id: string;
      occurredAt: string;
      message: string;
    };

export type WalletActivityContext = {
  balance: number;
  availableRewards: number;
  rewardGoal: number | null;
  rewardTiers: Array<{ stampsRequired: number; name: string }>;
  unitNameSingular: string;
  unitNamePlural: string;
};

export type WalletActivityMessageKind =
  | "NONE"
  | "PURCHASE"
  | "REWARD_UNLOCKED"
  | "REWARD_REDEEMED"
  | "CAMPAIGN";

export type WalletActivityMessage = {
  kind: WalletActivityMessageKind;
  /** Stable key for idempotent provider messages; null when there is no event. */
  eventKey: string | null;
  title: string;
  body: string;
};

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function formatUnits(value: number) {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

function unitLabel(value: number, context: WalletActivityContext) {
  return value === 1 ? context.unitNameSingular : context.unitNamePlural;
}

function quantity(value: number, context: WalletActivityContext) {
  return `${formatUnits(value)} ${unitLabel(value, context)}`;
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function truncateWalletText(value: string, maxLength: number) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function missingSentence(missing: number, target: string, context: WalletActivityContext) {
  return `Te ${missing === 1 ? "falta" : "faltan"} ${quantity(missing, context)} para ${target}.`;
}

function nextGoalSentence(context: WalletActivityContext) {
  const tiers = [...context.rewardTiers].sort(
    (left, right) => left.stampsRequired - right.stampsRequired,
  );
  const nextTier = tiers.find((tier) => tier.stampsRequired > context.balance);
  if (nextTier) {
    const missing = Math.max(1, nextTier.stampsRequired - context.balance);
    return missingSentence(missing, clean(nextTier.name), context);
  }
  if (context.rewardGoal && context.rewardGoal > context.balance) {
    return missingSentence(context.rewardGoal - context.balance, "tu próximo premio", context);
  }
  return "";
}

function listNames(names: string[]) {
  const cleaned = names.map(clean).filter(Boolean);
  if (cleaned.length <= 1) return cleaned[0] ?? "un premio";
  return `${cleaned.slice(0, -1).join(", ")} y ${cleaned.at(-1)}`;
}

function finalize(
  kind: WalletActivityMessageKind,
  eventKey: string | null,
  title: string,
  sentences: string[],
): WalletActivityMessage {
  return {
    kind,
    eventKey,
    title: truncateWalletText(title, WALLET_ACTIVITY_TITLE_MAX_LENGTH),
    body: truncateWalletText(
      sentences.filter(Boolean).join(" "),
      WALLET_ACTIVITY_MESSAGE_MAX_LENGTH,
    ),
  };
}

export function composeWalletActivityMessage(
  activity: WalletActivity,
  context: WalletActivityContext,
): WalletActivityMessage {
  if (activity.kind === "NONE") {
    return finalize("NONE", null, "Tu tarjeta", [WALLET_ACTIVITY_EMPTY_MESSAGE]);
  }

  if (activity.kind === "CAMPAIGN") {
    return finalize("CAMPAIGN", `campaign-${activity.id}`, "Mensaje para ti", [activity.message]);
  }

  if (activity.kind === "PURCHASE") {
    if (activity.unlockedRewardNames.length > 0) {
      const count = activity.unlockedRewardNames.length;
      const unlocked = count === 1
        ? `Desbloqueaste ${listNames(activity.unlockedRewardNames)}.`
        : `Desbloqueaste ${count} premios: ${listNames(activity.unlockedRewardNames)}.`;
      return finalize(
        "REWARD_UNLOCKED",
        `reward-unlocked-${activity.id}`,
        "¡Premio desbloqueado!",
        [
          "¡Felicidades!",
          unlocked,
          count === 1 ? "Muéstralo en caja para canjearlo." : "Muéstralos en caja para canjearlos.",
        ],
      );
    }
    const awarded = activity.unitsAwarded > 0
      ? `¡Gracias por tu compra! Sumaste ${quantity(activity.unitsAwarded, context)}. Ahora tienes ${quantity(context.balance, context)}.`
      : `Registramos tu compra. Tienes ${quantity(context.balance, context)}.`;
    return finalize("PURCHASE", `purchase-${activity.id}`, "Compra registrada", [
      awarded,
      nextGoalSentence(context),
    ]);
  }

  const remaining = context.availableRewards > 0
    ? context.availableRewards === 1
      ? "Te queda 1 premio disponible."
      : `Te quedan ${context.availableRewards} premios disponibles.`
    : `Sigue sumando ${context.unitNamePlural} con cada compra.`;
  return finalize("REWARD_REDEEMED", `reward-redeemed-${activity.id}`, "Premio canjeado", [
    `Canjeaste ${clean(activity.rewardName) || "tu premio"}. ¡Disfrútalo!`,
    remaining,
  ]);
}
