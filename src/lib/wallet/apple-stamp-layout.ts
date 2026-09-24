export const APPLE_WALLET_MAX_VISIBLE_STAMPS = 24;
export const APPLE_WALLET_MAX_STAMPS_PER_ROW = 8;
export const APPLE_WALLET_MAX_STAMP_ROWS = 6;

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

export function normalizeAppleWalletStampRows(
  visible: number,
  configuredRows: readonly number[] = [],
) {
  let remaining = Math.min(
    APPLE_WALLET_MAX_VISIBLE_STAMPS,
    Math.max(0, Math.trunc(visible)),
  );
  const rows: number[] = [];
  for (const rawCount of configuredRows.slice(0, APPLE_WALLET_MAX_STAMP_ROWS)) {
    if (!remaining) break;
    const count = Math.min(
      remaining,
      APPLE_WALLET_MAX_STAMPS_PER_ROW,
      Math.max(1, Math.trunc(rawCount)),
    );
    rows.push(count);
    remaining -= count;
  }
  while (remaining && rows.length < APPLE_WALLET_MAX_STAMP_ROWS) {
    const count = Math.min(remaining, APPLE_WALLET_MAX_STAMPS_PER_ROW);
    rows.push(count);
    remaining -= count;
  }
  return rows;
}

export function appleWalletStampLayout(
  visible: number,
  configuredRows: readonly number[] = [],
) {
  const defaultColumns = visible <= 5 ? Math.max(visible, 1) : visible <= 10 ? 5 : 8;
  const rows = normalizeAppleWalletStampRows(
    visible,
    configuredRows.length ? configuredRows : Array(Math.ceil(visible / defaultColumns)).fill(defaultColumns),
  );
  const columns = Math.max(1, ...rows);
  const gap = visible <= 10 ? 14 : 10;
  const defaultDiameter = visible <= 5 ? 54 : visible <= 10 ? 46 : visible <= 16 ? 34 : 32;
  const diameter = Math.max(20, Math.floor(Math.min(
    defaultDiameter,
    (351 - (columns - 1) * gap) / columns,
    (128 - Math.max(0, rows.length - 1) * gap) / Math.max(1, rows.length),
  )));
  return { columns, diameter, gap, rows };
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
