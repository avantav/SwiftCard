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

export function appleWalletRewardTierText(input: {
  required: number;
  name: string;
  description: string;
  unitNamePlural: string;
}) {
  return `${displayNumber(input.required)} ${input.unitNamePlural} · ${input.name}: ${input.description}`;
}
