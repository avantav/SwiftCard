const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[-+]?\d+(\.\d+)?$/;

/**
 * Escapes a CSV cell and neutralizes spreadsheet formula injection (SEC-006):
 * text starting with = + - @ tab or CR gets a leading apostrophe so Excel and
 * Sheets treat it as text. Plain numbers (e.g. -5 stamps) are kept as numbers.
 */
export function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = FORMULA_PREFIX.test(raw) && !PLAIN_NUMBER.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.map(csvCell), ...rows.map((row) => columns.map((column) => csvCell(row[column])))]
    .map((row) => row.join(","))
    .join("\r\n") + "\r\n";
}
