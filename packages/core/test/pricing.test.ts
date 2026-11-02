import { describe, expect, it } from 'vitest';
import { channelProfit, collectionCost, collectionPrice, effectiveMargin, floorPrice, listPrice, loosePrice, nicePrice, splitSet, suggestedPrice } from '../src/pricing';

const cost = 35.9474;

describe('Caso 3.1 — prices from the cost of 2.1', () => {
  it('margin 50 % → suggested 71.89, list price (formula) $72', () => {
    expect(suggestedPrice(cost, 50)).toBeCloseTo(71.89, 2);
    expect(listPrice({ mode: 'formula', price: 0, cost, marginPct: 50 })).toBe(72);
  });
  it('floor with minimum margin 30 % → $51.35', () => {
    expect(floorPrice(cost, 30)).toBeCloseTo(51.35, 2);
  });
  it('channel with 17 % commission → $108.93', () => {
    expect(suggestedPrice(cost, 50, 17)).toBeCloseTo(108.93, 2);
  });
  it('value mode keeps the written price; margin capped at 95 in formula mode', () => {
    expect(listPrice({ mode: 'value', price: 250, cost, marginPct: 50 })).toBe(250);
    expect(listPrice({ mode: 'formula', price: 0, cost: 10, marginPct: 120 })).toBe(Math.ceil(10 / 0.05));
  });
  it('margin: own or global', () => {
    expect(effectiveMargin(null, 50)).toBe(50);
    expect(effectiveMargin(40, 50)).toBe(40);
  });
});

describe('Caso 3.2 — set price', () => {
  const parts = [
    { qty: 2, listPrice: 72, cost: 30 },
    { qty: 1, listPrice: 50, cost: 20 },
  ];
  it('loose = $194; written $170 → $170; empty → $194', () => {
    expect(loosePrice(parts)).toBe(194);
    expect(collectionPrice(170, 194)).toBe(170);
    expect(collectionPrice(null, 194)).toBe(194);
    expect(collectionPrice(0, 194)).toBe(194);
  });
  it('set cost = Σ cost × qty + extras', () => {
    expect(collectionCost(parts, 5)).toEqual({ pieces: 80, extras: 5, total: 85 });
  });
});

describe('Caso 3.3 — split of a set sold at $170', () => {
  it('A gets 126.19, B gets 43.81', () => {
    const s = splitSet(170, [
      { qty: 2, listPrice: 72 },
      { qty: 1, listPrice: 50 },
    ]);
    expect(s[0]!.price).toBeCloseTo(126.19, 2);
    expect(s[1]!.price).toBeCloseTo(43.81, 2);
  });
});

describe('other helpers', () => {
  it('channel profit = price − commission − cost (caso 6.1: 23.81)', () => {
    expect(channelProfit(72, cost, 17)).toBeCloseTo(23.81, 2);
  });
  it('nice price rounding', () => {
    expect(nicePrice(12.2)).toBe(13);
    expect(nicePrice(71.89)).toBe(75);
    expect(nicePrice(203)).toBe(210);
  });
});
