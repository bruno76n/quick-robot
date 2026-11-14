import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { costProduct } from '../src/costs';
import {
  COST_AVG_PURCHASES, filamentCost, filamentCostPerGram, filamentCosts, filamentKey, filamentRemaining, filamentStatus,
  inventoryValue, nextSpoolNumbers, splitCents, spoolCostPerGram, spoolRemaining, spoolStatus, type SpoolInput,
} from '../src/filament';
import { aSpool } from './builders';

// Case 1.1a of docs/04 (ronda-4 §2.2a): PLA Gris with three purchases with cost and one gift spool.
const gray = (over: Record<string, Partial<SpoolInput>> = {}) => [
  aSpool({ id: 'g3', number: 3, purchasedOn: '2026-09-20', costPesos: 200, shippingPesos: 0, grams: 1000, ...over.g3 }),
  aSpool({ id: 'g5', number: 5, purchasedOn: '2026-10-10', costPesos: 250, shippingPesos: 0, grams: 1000, ...over.g5 }),
  aSpool({ id: 'g9', number: 9, purchasedOn: '2026-11-05', costPesos: 300, shippingPesos: 0, grams: 1000, ...over.g9 }),
  aSpool({ id: 'g7', number: 7, purchasedOn: '2026-09-15', costPesos: 0, shippingPesos: 0, grams: 1000, noCost: true, ...over.g7 }),
];
const noPurge = { kwhPrice: 0, purgePct: 0, failurePct: 0 };
const materialOnly = (costPerGram: number) => costProduct({ hours: 0, extras: 0, printer: null, filaments: [{ grams: 50, costPerGram }], supplies: [] }, [], noPurge).M;

describe('spool cost per gram (case 2.1 of ronda-4)', () => {
  it('(cost + shipping) / grams; a no-cost spool costs 0', () => {
    expect(spoolCostPerGram({ costPesos: 450, shippingPesos: 50, grams: 1000 })).toBe(0.5);
    expect(spoolCostPerGram({ costPesos: 450, shippingPesos: 50, grams: 0 })).toBe(0);
    expect(spoolCostPerGram({ costPesos: 450, shippingPesos: 50, grams: 1000, noCost: true })).toBe(0);
  });

  it('remaining is the sum of the ledger; negative leftovers do not count', () => {
    expect(filamentRemaining([aSpool({ remaining: -3 }), aSpool({ remaining: 20.04 })])).toBe(20);
    expect(spoolRemaining([1000, -47.6, -2.4])).toBe(950);
  });
});

describe('filament cost per gram = last N purchases with cost (docs/04 §1, cases 1.1a–g)', () => {
  it('case 1.1a (2.2a): (200 + 250 + 300) / 3,000 = $0.25/g, the gift spool does not count; a 50 g piece = $12.50 from any spool', () => {
    const c = filamentCost(gray());
    expect(c.costPerGram).toBeCloseTo(0.25, 10);
    expect(c.source).toBe('purchases');
    expect(c.spoolNumbers).toEqual([9, 5, 3]);
    expect(c.spoolIds).toEqual(['g9', 'g5', 'g3']);
    expect(materialOnly(c.costPerGram)).toBeCloseTo(12.5, 10);
  });

  it('it does not depend on what is left: empty spools with cost still count', () => {
    const c = filamentCost(gray({ g3: { remaining: 0 }, g5: { remaining: 640 }, g7: { remaining: 100 } }));
    expect(c.costPerGram).toBeCloseTo(0.25, 10);
    expect(c.spoolNumbers).toEqual([9, 5, 3]);
  });

  it('case 1.1b (2.2b): #12 at $280 → #12, #9, #5 → $0.276667/g; the 50 g piece $13.83', () => {
    const c = filamentCost([...gray(), aSpool({ id: 'g12', number: 12, purchasedOn: '2026-11-20', costPesos: 280, shippingPesos: 0, grams: 1000 })]);
    expect(c.costPerGram).toBeCloseTo(830 / 3000, 10);
    expect(c.costPerGram).toBeCloseTo(0.276667, 6);
    expect(c.spoolNumbers).toEqual([12, 9, 5]);
    expect(Math.round(materialOnly(c.costPerGram) * 100) / 100).toBe(13.83);
  });

  it('case 1.1c (2.2c): spools of different size are weighted by grams → (430 + 800) / 1,500 = $0.82/g', () => {
    const tpu = [
      aSpool({ id: 't20', number: 20, purchasedOn: '2026-10-01', costPesos: 430, shippingPesos: 0, grams: 500 }),
      aSpool({ id: 't21', number: 21, purchasedOn: '2026-10-02', costPesos: 800, shippingPesos: 0, grams: 1000 }),
    ];
    expect(filamentCostPerGram(tpu)).toBeCloseTo(0.82, 10);
  });

  it('case 1.1d (2.2d): PLA Blanco only has a gift spool → the PLA material average, $0.25/g', () => {
    const white = [aSpool({ id: 'w1', number: 1, purchasedOn: '2026-08-01', costPesos: 0, shippingPesos: 0, noCost: true })];
    const c = filamentCost(white, { materialSpools: [...white, ...gray()] });
    expect(c).toMatchObject({ source: 'material', spoolNumbers: [9, 5, 3] });
    expect(c.costPerGram).toBeCloseTo(0.25, 10);
  });

  it('case 1.1e (2.2e): PETG Naranja, gift spool only, no PETG purchases, reference $300/kg → $0.30/g', () => {
    const orange = [aSpool({ id: 'o1', costPesos: 0, shippingPesos: 0, noCost: true })];
    const c = filamentCost(orange, { materialSpools: orange, referenceCentsPerKg: 30000 });
    expect(c).toMatchObject({ source: 'reference', spoolNumbers: [], spoolIds: [] });
    expect(c.costPerGram).toBeCloseTo(0.3, 10);
  });

  it('without purchases, material or reference → 0 and source "none"', () => {
    const orange = [aSpool({ id: 'o1', costPesos: 0, shippingPesos: 0, noCost: true })];
    expect(filamentCost(orange)).toEqual({ costPerGram: 0, source: 'none', spoolIds: [], spoolNumbers: [] });
    expect(filamentCost(orange, { referenceCentsPerKg: null }).source).toBe('none');
    expect(filamentCost(orange, { referenceCentsPerKg: 0 }).source).toBe('none');
    expect(filamentCost([])).toMatchObject({ costPerGram: 0, source: 'none' });
  });

  it('case 1.1f (2.2f): with N = 1, PLA Gris = the #9 = $0.30/g', () => {
    const c = filamentCost(gray(), { n: 1 });
    expect(c.costPerGram).toBeCloseTo(0.3, 10);
    expect(c.spoolNumbers).toEqual([9]);
  });

  it('case 1.1g (2.2g): shipping counts → (300 + 250) / 2,000 = $0.275/g', () => {
    const s = [
      aSpool({ id: 's30', number: 30, purchasedOn: '2026-10-01', costPesos: 250, shippingPesos: 50, grams: 1000 }),
      aSpool({ id: 's31', number: 31, purchasedOn: '2026-10-02', costPesos: 250, shippingPesos: 0, grams: 1000 }),
    ];
    expect(filamentCostPerGram(s)).toBeCloseTo(0.275, 10);
  });

});

describe('filament cost per gram: what counts and the workspace map', () => {
  it('deleted spools and spools that cost $0 do not count; same date → higher number first, then higher id', () => {
    const s = [
      aSpool({ id: 'a', number: 1, purchasedOn: '2026-10-01', costPesos: 100, shippingPesos: 0 }),
      aSpool({ id: 'b', number: 2, purchasedOn: '2026-10-01', costPesos: 900, shippingPesos: 0 }),
      aSpool({ id: 'c', number: 3, purchasedOn: '2026-12-01', costPesos: 500, shippingPesos: 0, deleted: true }),
      aSpool({ id: 'd', number: 4, purchasedOn: '2026-12-02', costPesos: 0, shippingPesos: 0 }),
    ];
    expect(filamentCost(s, { n: 1 })).toMatchObject({ spoolIds: ['b'], costPerGram: 0.9 });
    const noNumbers = s.map(({ number: _n, ...x }) => x);
    expect(filamentCost(noNumbers, { n: 1 }).spoolIds).toEqual(['b']);
    expect(filamentCost([...noNumbers].reverse(), { n: 1 }).spoolIds).toEqual(['b']);
  });

  it('N is 3 by default and kept between 1 and 10', () => {
    expect(COST_AVG_PURCHASES).toEqual({ min: 1, max: 10, default: 3 });
    const many = Array.from({ length: 12 }, (_, i) => aSpool({ id: `m${i}`, number: i + 1, purchasedOn: `2026-01-${String(i + 1).padStart(2, '0')}`, costPesos: (i + 1) * 100, shippingPesos: 0, grams: 1000 }));
    expect(filamentCost(many).spoolNumbers).toEqual([12, 11, 10]);
    expect(filamentCost(many, { n: 0 }).spoolNumbers).toEqual([12]);
    expect(filamentCost(many, { n: 50 }).spoolNumbers).toHaveLength(10);
    expect(filamentCost(many, { n: Number.NaN }).spoolNumbers).toHaveLength(3);
  });

  it('filamentCosts: every filament of the workspace, with the material fallback (case-insensitive)', () => {
    const spools = [
      ...gray().map((s) => ({ ...s, filamentId: 'gray' })),
      aSpool({ id: 'w1', number: 1, costPesos: 0, shippingPesos: 0, noCost: true, filamentId: 'white' } as never) as SpoolInput & { filamentId: string },
      aSpool({ id: 'o1', number: 2, costPesos: 0, shippingPesos: 0, noCost: true, filamentId: 'orange' } as never) as SpoolInput & { filamentId: string },
    ];
    const m = filamentCosts([
      { id: 'gray', material: 'PLA' }, { id: 'white', material: 'pla ' }, { id: 'orange', material: 'PETG', referenceCentsPerKg: 30000 }, { id: 'none', material: 'ABS' },
    ], spools);
    expect(m.get('gray')!.costPerGram).toBeCloseTo(0.25, 10);
    expect(m.get('white')).toMatchObject({ source: 'material', spoolNumbers: [9, 5, 3] });
    expect(m.get('orange')).toMatchObject({ source: 'reference' });
    expect(m.get('none')).toMatchObject({ source: 'none', costPerGram: 0 });
    expect(filamentCosts([{ id: 'gray', material: 'PLA' }], spools, 1).get('gray')!.spoolNumbers).toEqual([9]);
  });
});

describe('inventory value (case 1.4 = ronda-4 2.3)', () => {
  it('PLA Gris with #3 empty, #5 640 g, #7 100 g (gift), #9 1,000 g → $460.00', () => {
    const s = gray({ g3: { remaining: 0 }, g5: { remaining: 640 }, g7: { remaining: 100 }, g9: { remaining: 1000 } });
    expect(inventoryValue(s)).toBeCloseTo(460, 10);
  });

  it('negative leftovers and deleted spools are worth nothing', () => {
    expect(inventoryValue([aSpool({ remaining: -5 }), aSpool({ remaining: 100, deleted: true }), aSpool({ remaining: 10 })])).toBeCloseTo(5, 10);
    expect(inventoryValue([])).toBe(0);
  });
});

describe('spool numbers (ronda-4 2.4) and shipping split (§4 addSpool)', () => {
  it('starts at 1, next is max + 1, never reuses a number (deleted ones keep theirs); quantity N → consecutive', () => {
    expect(nextSpoolNumbers([], 1)).toEqual([1]);
    expect(nextSpoolNumbers([1, 2, 3], 2)).toEqual([4, 5]);
    expect(nextSpoolNumbers([4, 1], 3)).toEqual([5, 6, 7]);
    expect(nextSpoolNumbers([1], 0)).toEqual([]);
  });

  it('shipping of the order split among N spools, the cents left over go to the first', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCents(5000, 2)).toEqual([2500, 2500]);
    expect(splitCents(5000, 1)).toEqual([5000]);
    expect(splitCents(0, 2)).toEqual([0, 0]);
    expect(splitCents(2, 3)).toEqual([2, 0, 0]);
    expect(splitCents(100, 0)).toEqual([]);
    fc.assert(fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 1, max: 20 }), (total, n) => {
      const parts = splitCents(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      for (const p of parts) expect(Number.isInteger(p)).toBe(true);
    }));
  });
});

describe('status', () => {
  const one = (remaining: number, grams = 1000) => [aSpool({ grams, remaining })];
  it('case 1.3: filament with a single 1000 g spool', () => {
    expect(filamentStatus(one(960))).toBe('new');
    expect(filamentStatus(one(940))).toBe('ok');
    expect(filamentStatus(one(301))).toBe('ok');
    expect(filamentStatus(one(300))).toBe('low');
    expect(filamentStatus(one(150))).toBe('ending');
    expect(filamentStatus(one(0.4))).toBe('out');
    expect(filamentStatus(one(250, 250))).toBe('low');
    expect(filamentStatus([])).toBe('no_spools');
  });

  it('spool status: empty, new, in use', () => {
    expect(spoolStatus({ remaining: 0.5, grams: 1000 })).toBe('empty');
    expect(spoolStatus({ remaining: 950, grams: 1000 })).toBe('new');
    expect(spoolStatus({ remaining: 949.9, grams: 1000 })).toBe('in_use');
  });

  it('same filament regardless of spacing and case', () => {
    expect(filamentKey('PLA  ', 'negro')).toBe(filamentKey('pla', ' Negro'));
    expect(filamentKey('PLA', 'Negro mate')).not.toBe(filamentKey('PLA', 'Negro'));
  });
});
