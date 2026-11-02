import { fromCents, toCents } from '@app/core';
import { parseAmount } from './format';

/** Text field (pesos) → cents; empty or invalid → fallback. */
export const centsFromText = (v: string, fallback = 0): number => {
  const n = parseAmount(v);
  return Number.isFinite(n) ? toCents(n) : fallback;
};
/** Cents → text for an input (no thousands separator, no trailing .00). */
export const textFromCents = (c: number | null | undefined): string => (c == null ? '' : String(Math.round(fromCents(c) * 100) / 100));
/** Number field → number; empty or invalid → fallback. */
export const numFromText = (v: string, fallback = 0): number => {
  const n = parseAmount(v);
  return Number.isFinite(n) ? n : fallback;
};
export const textFromNum = (n: number | null | undefined): string => (n == null ? '' : String(Math.round(n * 1000) / 1000));
