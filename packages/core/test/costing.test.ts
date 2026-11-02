import { describe, expect, it } from 'vitest';
import { costCollection, costProduct, mergeParts, type CostingContext } from '../src/costing';

const ctx: CostingContext = {
  settings: { kwhPrice: 3, purgePct: 5, failurePct: 5, minMarginPct: 30, formulaMarginPct: 50 },
  printers: [{ id: 'p1', cost: 6000, lifeHours: 3000, maintenancePerHour: 0.5, kw: 0.15 }],
  filaments: { f1: { costPerGram: 0.5, material: 'PLA' }, f2: { costPerGram: 0.46, material: 'PETG' } },
  supplies: { s1: { cost: 1.5 } },
};

describe('costProduct (caso 2.1 + 3.1 through the shared function)', () => {
  it('formula piece', () => {
    const r = costProduct({ mode: 'formula', price: 0, marginPct: null, printerId: 'p1', hours: 2, extras: 2, filaments: [{ filamentId: 'f1', grams: 50 }], supplies: [] }, ctx);
    expect(r.total).toBeCloseTo(35.9474, 4);
    expect(r.listPrice).toBe(72);
    expect(r.floor).toBeCloseTo(51.35, 2);
    expect(r.technical).toBe(false);
  });
  it('unknown filaments/supplies are ignored; PETG is technical', () => {
    const r = costProduct({ mode: 'value', price: 100, marginPct: null, printerId: null, hours: 0, extras: 0, filaments: [{ filamentId: 'f2', grams: 10 }, { filamentId: 'gone', grams: 99 }], supplies: [{ supplyId: 's1', qty: 2 }, { supplyId: 'x', qty: 9 }] }, { ...ctx, settings: { ...ctx.settings, failurePct: 0 } });
    expect(r.M).toBeCloseTo(10 * 0.46 * 1.05, 10);
    expect(r.E).toBe(3);
    expect(r.technical).toBe(true);
    expect(r.profit).toBeCloseTo(100 - r.total, 10);
  });
});

describe('costCollection', () => {
  it('caso 3.2 through the shared function; deleted pieces ignored', () => {
    const costed = { a: { listPrice: 72, total: 30 }, b: { listPrice: 50, total: 20 } };
    const r = costCollection({ price: null, extras: 5, parts: [{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }, { productId: 'gone', qty: 3 }] }, costed, 30);
    expect(r.loose).toBe(194);
    expect(r.price).toBe(194);
    expect(r.cost).toBe(85);
    expect(r.pieceCount).toBe(3);
  });
  it('merge repeated parts', () => {
    expect(mergeParts([{ productId: 'a', qty: 1 }, { productId: 'b', qty: 2 }, { productId: 'a', qty: 2.4 }, { productId: '', qty: 1 }])).toEqual([{ productId: 'a', qty: 3 }, { productId: 'b', qty: 2 }]);
  });
});
