import { describe, expect, it } from 'vitest';
import { effectiveMargin, floorPrice, listPrice, looseSum, nicePrice, profitAt, setCost, setPrice, splitSetPrice, suggestedPrice } from '../src/pricing';

const total = 35.9474;

describe('prices', () => {
  it('case 3.1: suggested 71.89 → list $72; floor $51.35; channel 17 % → $108.93', () => {
    expect(suggestedPrice(total, 50)).toBeCloseTo(71.89, 2);
    expect(listPrice('formula', total, 50, 0)).toBe(72);
    expect(floorPrice(total, 30)).toBeCloseTo(51.35, 2);
    expect(suggestedPrice(total, 50, 17)).toBeCloseTo(108.93, 2);
  });

  it('value mode keeps the typed price; formula margin is capped at 95 %', () => {
    expect(listPrice('value', total, 50, 99)).toBe(99);
    expect(listPrice('value', total, 50, 0)).toBe(0);
    expect(listPrice('formula', 10, 99, 0)).toBe(Math.ceil(10 / 0.05));
  });

  it('own margin or the global formula margin', () => {
    expect(effectiveMargin(40, 50)).toBe(40);
    expect(effectiveMargin(null, 50)).toBe(50);
    expect(effectiveMargin(undefined, 50)).toBe(50);
    expect(effectiveMargin(Number.NaN, 50)).toBe(50);
  });

  const parts = [{ productId: 'A', qty: 2, listPrice: 72, cost: 30 }, { productId: 'B', qty: 1, listPrice: 50, cost: 10 }];
  it('case 3.2: loose $194; typed $170 wins; empty → $194', () => {
    expect(looseSum(parts)).toBe(194);
    expect(setPrice(170, parts)).toBe(170);
    expect(setPrice(0, parts)).toBe(194);
    expect(setPrice(null, parts)).toBe(194);
    expect(setCost(parts, 5)).toBe(75);
  });

  it('case 3.3: $170 split → A $126.19, B $43.81', () => {
    const [a, b] = splitSetPrice(170, parts);
    expect(a!.amount).toBeCloseTo(126.19, 2);
    expect(b!.amount).toBeCloseTo(43.81, 2);
    expect(splitSetPrice(10, [{ productId: 'Z', qty: 1, listPrice: 0, cost: 0 }])[0]!.amount).toBe(0);
  });

  it('friendly rounding and profit by channel', () => {
    expect([nicePrice(12.1), nicePrice(71.89), nicePrice(201)]).toEqual([13, 75, 210]);
    const p = profitAt(100, 40, 17);
    expect(p).toEqual({ commission: 17, profit: 43, marginPct: 43 });
    expect(profitAt(0, 10, 0).marginPct).toBe(0);
  });
});
