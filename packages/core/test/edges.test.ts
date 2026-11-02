// Edge branches of the filament and catalog rules (keep core at 90 % branches, docs/14 §4).
import { describe, expect, it } from 'vitest';
import { normalizeName, tidyName } from '../src/catalog';
import { filamentCostPerGram, planDeduction, spoolUseOrder } from '../src/filament';
import { aSpool } from './builders';

describe('edges', () => {
  it('names tolerate missing values', () => {
    expect(normalizeName(undefined as unknown as string)).toBe('');
    expect(tidyName(null as unknown as string)).toBe('');
  });

  it('last purchase: same date breaks the tie by id', () => {
    const a = aSpool({ id: 'a', purchasedOn: '2026-05-01', costPesos: 100, shippingPesos: 0, remaining: 0 });
    const b = aSpool({ id: 'b', purchasedOn: '2026-05-01', costPesos: 900, shippingPesos: 0, remaining: 0 });
    expect(filamentCostPerGram([a, b])).toBeCloseTo(0.9, 10);
    expect(filamentCostPerGram([b, a])).toBeCloseTo(0.9, 10);
  });

  it('use order: full spools after opened ones; same date by id either way', () => {
    const x = aSpool({ id: 'x', purchasedOn: '2026-01-01', remaining: 1000 });
    const y = aSpool({ id: 'y', purchasedOn: '2026-01-01', remaining: 1000 });
    expect(spoolUseOrder([y, x]).map((s) => s.id)).toEqual(['x', 'y']);
    expect(spoolUseOrder([x, y]).map((s) => s.id)).toEqual(['x', 'y']);
    const opened = aSpool({ id: 'z', purchasedOn: '2026-12-01', remaining: 10 });
    expect(spoolUseOrder([x, opened]).map((s) => s.id)).toEqual(['z', 'x']);
  });

  it('deduction skips spools that end up with nothing and ignores a negative leftover', () => {
    const tiny = aSpool({ id: 't', remaining: 0.04 });
    const neg = aSpool({ id: 'n', remaining: -5 });
    const ok = aSpool({ id: 'o', remaining: 100 });
    const d = planDeduction([tiny, neg, ok], 10, 0);
    expect(d.movements).toEqual([{ spoolId: 'o', kind: 'consumption', grams: -10 }]);
    expect(planDeduction([ok], Number.NaN, 5)).toEqual({ movements: [], taken: 0, missing: 0 });
  });
});
