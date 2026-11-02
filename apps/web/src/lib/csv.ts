// CSV for Excel (docs/06 §15 › Exportar a Excel): UTF-8 with BOM so accents open right, quoted cells, CRLF rows.
// Cells that start like a formula are prefixed with an apostrophe so the spreadsheet shows them as text (OWASP: CSV injection).

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA = /^[=+\-@\t\r]/;
export const BOM = '﻿';

/** One cell: numbers stay as they are; text that looks like a formula gets an apostrophe; quotes when needed. */
export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole table, without BOM (for copying to the clipboard). */
export function csvText(head: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** The file contents: BOM + table. */
export function csvFile(head: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return BOM + csvText(head, rows);
}

/** Pesos with two decimals at most, as a number Excel can add (no currency sign). */
export const csvMoney = (cents: number) => Math.round(cents) / 100;

/** File name: prefix-entity-YYYY-MM-DD.csv, only safe characters. */
export function csvName(prefix: string, entity: string, today: string): string {
  const clean = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${[clean(prefix), clean(entity)].filter(Boolean).join('-')}-${today}.csv`;
}
