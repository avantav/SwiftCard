function displayNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function appleWalletProgressText(input: {
  balance: number;
  goal: number | null;
  unitNameSingular: string;
  unitNamePlural: string;
}) {
  const balance = displayNumber(input.balance);
  if (input.goal) {
    return `${balance} de ${displayNumber(input.goal)} ${input.unitNamePlural}`;
  }
  const unit = input.balance === 1
    ? input.unitNameSingular
    : input.unitNamePlural;
  return `${balance} ${unit}`;
}

export function appleWalletPointProgressText(input: {
  balance: number;
  goal: number | null;
  complete?: boolean;
}) {
  const segmentCount = 5;
  if (input.complete) {
    return `${"■".repeat(segmentCount)} Completo`;
  }
  if (!input.goal || input.goal <= 0) {
    return displayNumber(input.balance);
  }
  const filled = Math.min(
    segmentCount,
    Math.max(0, Math.floor((input.balance / input.goal) * segmentCount)),
  );
  const bar = `${"■".repeat(filled)}${"□".repeat(segmentCount - filled)}`;
  return `${bar} ${displayNumber(input.balance)}/${displayNumber(input.goal)}`;
}

export function appleWalletRewardTierText(input: {
  required: number;
  name: string;
  description: string;
  unitNamePlural: string;
}) {
  return `${displayNumber(input.required)} ${input.unitNamePlural} · ${input.name}: ${input.description}`;
}
