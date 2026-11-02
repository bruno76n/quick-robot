// Money rules (docs/04 › Convenciones): core computes in pesos; the database stores integer cents.
// Rounding happens at the edges (when saving), never in the middle of a formula.

export type Cents = number & { readonly __brand: 'Cents' };

/** Round to 2 decimals, avoiding binary artifacts (1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100 || 0;
}

/** Round to 1 decimal (grams). */
export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10 || 0;
}

export function toCents(pesos: number): Cents {
  return Math.round(round2(pesos) * 100) as Cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumCents(values: readonly number[]): Cents {
  return values.reduce((a, b) => a + b, 0) as Cents;
}
