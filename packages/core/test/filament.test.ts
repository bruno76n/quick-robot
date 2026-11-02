import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  filamentCostPerGram, filamentKey, filamentRemaining, filamentShortfall, filamentStatus, planDeduction,
  spoolCostPerGram, spoolRemaining, spoolStatus, spoolUseOrder,
} from '../src/filament';
import { aSpool } from './builders';

describe('filament cost per gram', () => {
  it('case 1.1: weighted by what is left → $0.54', () => {
    const a = aSpool({ grams: 1000, costPesos: 500, shippingPesos: 0, remaining: 600 });
    const b = aSpool({ grams: 1000, costPesos: 600, shippingPesos: 0, remaining: 400 });
    expect(spoolCostPerGram(a)).toBeCloseTo(0.5, 10);
    expect(filamentCostPerGram([a, b])).toBeCloseTo(0.54, 10);
  });

  it('uses the last purchase when nothing is left', () => {
    const old = aSpool({ purchasedOn: '2026-01-01', costPesos: 400, shippingPesos: 0, remaining: 0 });
    const last = aSpool({ purchasedOn: '2026-05-01', costPesos: 520, shippingPesos: 30, remaining: 0.3 });
    expect(filamentCostPerGram([old, last])).toBeCloseTo(0.55, 10);
    expect(filamentCostPerGram([])).toBe(0);
  });

  it('includes shipping and ignores negative leftovers', () => {
    expect(spoolCostPerGram({ costPesos: 450, shippingPesos: 50, grams: 1000 })).toBe(0.5);
    expect(spoolCostPerGram({ costPesos: 450, shippingPesos: 50, grams: 0 })).toBe(0);
    expect(filamentRemaining([aSpool({ remaining: -3 }), aSpool({ remaining: 20.04 })])).toBe(20);
    expect(spoolRemaining([1000, -47.6, -2.4])).toBe(950);
  });
});

describe('spool order and deduction', () => {
  it('uses the opened spool first, then the oldest, ties by id', () => {
    const fullOld = aSpool({ id: 'b', purchasedOn: '2026-01-01', remaining: 1000 });
    const opened = aSpool({ id: 'c', purchasedOn: '2026-06-01', remaining: 400 });
    const fullOldTie = aSpool({ id: 'a', purchasedOn: '2026-01-01', remaining: 1000 });
    const empty = aSpool({ id: 'd', remaining: 0 });
    expect(spoolUseOrder([fullOld, opened, fullOldTie, empty]).map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('case 1.2: purge 5 %, 50 g left, job asks 100 g → 47.6 g consumption + 2.4 g purge, missing 55 g', () => {
    const s = aSpool({ remaining: 50 });
    const d = planDeduction([s], 100, 5);
    expect(d.movements).toEqual([
      { spoolId: s.id, kind: 'consumption', grams: -47.6 },
      { spoolId: s.id, kind: 'waste', grams: -2.4 },
    ]);
    expect(d.taken).toBe(50);
    expect(d.missing).toBe(55);
    expect(spoolRemaining([50, ...d.movements.map((m) => m.grams)])).toBe(0);
  });

  it('splits across spools and nothing is missing when it fits', () => {
    const a = aSpool({ id: 'a', remaining: 30 });
    const b = aSpool({ id: 'b', remaining: 1000 });
    const d = planDeduction([a, b], 100, 5);
    expect(d.taken).toBe(105);
    expect(d.missing).toBe(0);
    expect(d.movements.filter((m) => m.spoolId === 'a').reduce((x, m) => x + m.grams, 0)).toBe(-30);
  });

  it('nothing to take when there is nothing or nothing asked', () => {
    expect(planDeduction([aSpool({ remaining: 0 })], 10, 5)).toEqual({ movements: [], taken: 0, missing: 10.5 });
    expect(planDeduction([aSpool()], 0, 5)).toEqual({ movements: [], taken: 0, missing: 0 });
  });

  it('shortfall before producing', () => {
    expect(filamentShortfall(100, 5, 50)).toBe(55);
    expect(filamentShortfall(100, 5, 105)).toBe(0);
  });

  it('property: a spool never ends negative, whatever the jobs', () => {
    fc.assert(fc.property(
      fc.array(fc.double({ min: 0, max: 1200, noNaN: true }), { minLength: 1, maxLength: 4 }),
      fc.array(fc.double({ min: 0.1, max: 800, noNaN: true }), { maxLength: 8 }),
      fc.integer({ min: 0, max: 20 }),
      (lefts, jobs, purge) => {
        let spools = lefts.map((r, i) => aSpool({ id: `p${i}`, remaining: Math.round(r * 10) / 10 }));
        for (const g of jobs) {
          const d = planDeduction(spools, g, purge);
          spools = spools.map((s) => ({ ...s, remaining: spoolRemaining([s.remaining, ...d.movements.filter((m) => m.spoolId === s.id).map((m) => m.grams)]) }));
          for (const s of spools) expect(s.remaining).toBeGreaterThanOrEqual(0);
        }
      },
    ));
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
