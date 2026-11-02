/** Display formatting (es-MX). Money and grams come from core so client and server format the same. */
export { formatGrams, formatMoney, formatMoney0, formatMoneyAuto, formatNumber1 } from '@app/core';

const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "3 oct" (mockup `fDate`). Input is a calendar date YYYY-MM-DD. */
export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');
}

/** Today as YYYY-MM-DD in the browser's time zone (default purchase date). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parses "1,234.50", "$350" or "350" into a number; empty → NaN. */
export function parseAmount(v: string): number {
  const s = v.replace(/[,\s$]/g, '');
  return s === '' ? Number.NaN : Number(s);
}
