// Formats of docs/13 §2.1 (es-MX, MXN). Same output as the mockup helpers.
const money0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const list = new Intl.ListFormat('es-MX', { style: 'long', type: 'conjunction' });

/** Totals and lists: pesos without cents. */
export const moneyTotal = (pesos: number) => money0.format(Math.round(pesos || 0));
/** Prices, unit costs, payments: cents only when there are real cents. */
export const money = (pesos: number) => (Math.abs((pesos || 0) - Math.round(pesos || 0)) < 0.005 ? money0.format(Math.round(pesos || 0)) : money2.format(pesos || 0));
/** Always two decimals (cost per gram). */
export const money2d = (pesos: number) => money2.format(pesos || 0);
export const cents = (c: number) => money(c / 100);
export const centsTotal = (c: number) => moneyTotal(c / 100);
export const grams = (g: number) => `${num1.format(g || 0)} g`;
export const number1 = (n: number) => num1.format(n || 0);
export const pct = (n: number) => `${num1.format(n || 0)}%`;

export function hours(h: number): string {
  const m = Math.round((h || 0) * 60);
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** Queue durations: ya, N min, H h M min, D d H h (from 48 h). */
export function queueDuration(minutes: number): string {
  const h = Math.max(0, minutes) / 60;
  if (minutes < 1) return 'ya';
  if (h >= 48) return `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return hours(h);
}

/** Calendar date "31 oct" (input YYYY-MM-DD, never shifted by the time zone). */
export const date = (iso: string) => shortDate.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 864e5);
}

/** hoy, mañana, en N días, hace N d. */
export function relativeDay(iso: string, today: string): string {
  const n = daysBetween(today, iso);
  if (n < 0) return `hace ${-n} d`;
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}

export const overdue = (iso: string, today: string) => `Retrasado ${Math.max(0, -daysBetween(today, iso))} d`;
export const folio = (n: number) => `#${n}`;
export const listOf = (items: readonly string[]) => list.format(items);
