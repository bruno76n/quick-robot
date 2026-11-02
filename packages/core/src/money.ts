/**
 * Money and quantity helpers.
 * Database stores integer cents (`*_cents`); core computes in pesos (floating point) and rounds only at the edges.
 */

/** Round to 2 decimals, half away from zero (mockup `round2`, symmetric for negatives). */
export function round2(x: number): number {
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + Number.EPSILON) * 100)) / 100;
}

/** Round to 1 decimal (grams are stored with one decimal). */
export function round1(x: number): number {
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + Number.EPSILON) * 10)) / 10;
}

/** Pesos → integer cents. This is the "edge" where rounding happens. */
export function toCents(pesos: number): number {
  if (!Number.isFinite(pesos)) throw new RangeError(`Invalid amount: ${pesos}`);
  return Math.round(round2(pesos) * 100);
}

/** Integer cents → pesos. */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents)) throw new RangeError(`Cents must be an integer: ${cents}`);
  return cents / 100;
}

const LOCALE = 'es-MX';
const money2 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const number1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** "$1,234.50" (mockup `mx`). */
export const formatMoney = (pesos: number): string => money2.format(pesos || 0);
/** "$1,235" (mockup `mx0`). */
export const formatMoney0 = (pesos: number): string => money0.format(Math.round(pesos || 0));
/** Whole amounts without decimals, otherwise two decimals (mockup `mxp`). */
export const formatMoneyAuto = (pesos: number): string =>
  Math.abs((pesos || 0) - Math.round(pesos || 0)) < 0.005 ? formatMoney0(pesos) : formatMoney(pesos);
/** "1,234.5" (mockup `nf1`). */
export const formatNumber1 = (x: number): string => number1.format(x);
/** "1,234.5 g" (mockup `gfmt`). */
export const formatGrams = (g: number): string => `${number1.format(g)} g`;
