import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromCents, round1, round2, sumCents, toCents } from '../src/money';

describe('money', () => {
  it('rounds to cents without binary artifacts', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(35.9474)).toBe(35.95);
    expect(round1(47.619)).toBe(47.6);
  });

  it('converts pesos to integer cents and back', () => {
    expect(toCents(35.9474)).toBe(3595);
    expect(fromCents(3595)).toBe(35.95);
    expect(sumCents([100, 250, 5])).toBe(355);
  });

  it('property: rounding when saving and recomputing never moves a total by more than $0.01', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: 0, max: 100_000, noNaN: true }), { maxLength: 50 }), (xs) => {
      const exact = xs.reduce((a, b) => a + b, 0);
      const saved = fromCents(toCents(exact));
      expect(Math.abs(saved - exact)).toBeLessThanOrEqual(0.0051);
    }));
  });
});
