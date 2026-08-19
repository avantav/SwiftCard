export const APPLE_WALLET_MAX_VISIBLE_STAMPS = 24;

export function appleWalletStampSlots(
  stampBalance: number,
  rewardGoal: number | null,
) {
  const goal = Math.max(0, Math.trunc(rewardGoal ?? 0));
  if (!goal) return { goal: 0, earned: 0, visible: 0, filled: 0 };
  const earned = Math.min(goal, Math.max(0, Math.trunc(stampBalance)));
  const visible = Math.min(goal, APPLE_WALLET_MAX_VISIBLE_STAMPS);
  const proportional = Math.round((earned / goal) * visible);
  const filled = goal <= APPLE_WALLET_MAX_VISIBLE_STAMPS
    ? earned
    : earned === 0
      ? 0
      : earned >= goal
        ? visible
        : Math.min(visible - 1, Math.max(1, proportional));
  return { goal, earned, visible, filled };
}

export function appleWalletStampLayout(visible: number) {
  if (visible <= 5) return { columns: Math.max(visible, 1), diameter: 54, gap: 14 };
  if (visible <= 10) return { columns: 5, diameter: 46, gap: 14 };
  if (visible <= 16) return { columns: 8, diameter: 34, gap: 10 };
  return { columns: 8, diameter: 32, gap: 10 };
}

export function appleWalletStampRows(visible: number, columns: number) {
  const safeVisible = Math.max(0, Math.trunc(visible));
  const safeColumns = Math.max(1, Math.trunc(columns));
  return Array.from(
    { length: Math.ceil(safeVisible / safeColumns) },
    (_, row) => Array.from(
      { length: Math.min(safeColumns, safeVisible - row * safeColumns) },
      (__, column) => row * safeColumns + column,
    ),
  );
}
