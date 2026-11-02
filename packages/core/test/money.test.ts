import { describe, expect, it } from 'vitest';
import { formatGrams, formatMoney, formatMoney0, formatMoneyAuto, fromCents, round1, round2, toCents } from '../src/money';

describe('money', () => {
  it('round2 rounds half away from zero, also for float artifacts', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(35.9474)).toBe(35.95);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it('round1 for grams', () => {
    expect(round1(47.619)).toBe(47.6);
    expect(round1(2.381)).toBe(2.4);
  });
  it('pesos ↔ cents at the edges', () => {
    expect(toCents(35.9474)).toBe(3595);
    expect(toCents(390)).toBe(39000);
    expect(toCents(-12.345)).toBe(-1235);
    expect(fromCents(3595)).toBe(35.95);
    expect(() => fromCents(1.5)).toThrow();
    expect(() => toCents(Number.NaN)).toThrow();
  });
  it('formats like the mockup (es-MX, MXN)', () => {
    expect(formatMoney(0.54)).toBe('$0.54');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney0(1234.5)).toBe('$1,235');
    expect(formatMoneyAuto(72)).toBe('$72');
    expect(formatMoneyAuto(71.89)).toBe('$71.89');
    expect(formatGrams(1234.56)).toBe('1,234.6 g');
  });
});
