/**
 * CSV export without formula injection (docs/11 · A05): a cell that starts with = + - @ (or tab / CR) is
 * prefixed with an apostrophe so a spreadsheet shows it as text instead of running it.
 */
const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const safe = DANGEROUS_START.test(value) ? `'${value}` : value;
  return /[",\n\r;]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
