import { describe, expect, it } from 'vitest';
import {
  filamentCostPerGram,
  filamentKey,
  filamentRemaining,
  filamentShortfalls,
  filamentStatus,
  planDeduction,
  spoolConsumptionOrder,
  spoolCostPerGram,
  spoolRemaining,
  spoolStatus,
  withRemaining,
  type SpoolFacts,
  type SpoolWithRemaining,
} from '../src/filament';

const spool = (o: Partial<SpoolWithRemaining> & { id: string }): SpoolWithRemaining => ({
  cost: 0,
  shipping: 0,
  grams: 1000,
  purchasedOn: '2026-01-01',
  remaining: 1000,
  ...o,
});

describe('spool cost per gram = (cost + shipping) / grams', () => {
  it('includes shipping', () => {
    expect(spoolCostPerGram({ cost: 350, shipping: 40, grams: 1000 })).toBeCloseTo(0.39, 10);
  });
  it('guards zero grams', () => {
    expect(spoolCostPerGram({ cost: 350, shipping: 40, grams: 0 })).toBe(0);
  });
});

describe('remaining is the sum of the ledger', () => {
  it('sums movements of the spool only', () => {
    const movs = [
      { spoolId: 'a', grams: 1000 },
      { spoolId: 'a', grams: -400 },
      { spoolId: 'b', grams: 500 },
    ];
    expect(spoolRemaining('a', movs)).toBe(600);
  });
  it('a spool never counts as negative in the filament total', () => {
    expect(filamentRemaining([spool({ id: 'a', remaining: -3 }), spool({ id: 'b', remaining: 200 })])).toBe(200);
  });
});

describe('Caso 1.1 — weighted cost per gram of a filament', () => {
  it('600 g at $0.50/g and 400 g at $0.60/g → $0.54', () => {
    const spools: SpoolFacts[] = [
      { id: 'A', cost: 500, shipping: 0, grams: 1000, purchasedOn: '2026-01-01' },
      { id: 'B', cost: 270, shipping: 30, grams: 500, purchasedOn: '2026-02-01' },
    ];
    const movs = [
      { spoolId: 'A', grams: 1000 },
      { spoolId: 'A', grams: -400 },
      { spoolId: 'B', grams: 500 },
      { spoolId: 'B', grams: -100 },
    ];
    const s = withRemaining(spools, movs);
    expect(s.map((x) => x.remaining)).toEqual([600, 400]);
    expect(filamentCostPerGram(s)).toBeCloseTo(0.54, 10);
  });
  it('nothing left (≤ 0.5 g) → cost per gram of the latest purchase', () => {
    const s = [
      spool({ id: 'old', cost: 500, grams: 1000, purchasedOn: '2026-01-01', remaining: 0.3 }),
      spool({ id: 'new', cost: 600, grams: 1000, purchasedOn: '2026-03-01', remaining: 0 }),
    ];
    expect(filamentCostPerGram(s)).toBeCloseTo(0.6, 10);
  });
  it('no spools → 0', () => {
    expect(filamentCostPerGram([])).toBe(0);
  });
});

describe('consumption order: opened first, then oldest, tie by id', () => {
  it('orders spools', () => {
    const s = [
      spool({ id: 'c', purchasedOn: '2026-01-01', remaining: 1000 }),
      spool({ id: 'b', purchasedOn: '2026-03-01', remaining: 700 }),
      spool({ id: 'a', purchasedOn: '2026-01-01', remaining: 1000 }),
      spool({ id: 'z', purchasedOn: '2025-12-01', remaining: 0 }),
    ];
    expect(spoolConsumptionOrder(s).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('Caso 1.2 — deduct a job with purge', () => {
  it('purge 5 %, 50 g left, job asks 100 g → consumption 47.6, purge 2.4, inventory 0, missing 55 g', () => {
    const s = [spool({ id: 'r1', remaining: 50 })];
    const plan = planDeduction(s, 100, 5);
    expect(plan.consumed).toBeCloseTo(47.6, 10);
    expect(plan.purged).toBeCloseTo(2.4, 10);
    expect(plan.movements).toEqual([
      { spoolId: 'r1', kind: 'consumption', grams: -47.6 },
      { spoolId: 'r1', kind: 'waste', grams: -2.4 },
    ]);
    const left = 50 + plan.movements.reduce((a, m) => a + m.grams, 0);
    expect(left).toBeCloseTo(0, 10);
    expect(plan.missing).toBeCloseTo(55, 10);
  });

  it('enough material: takes g·(1+p/100) across spools in order, none negative', () => {
    const s = [
      spool({ id: 'open', purchasedOn: '2026-02-01', remaining: 30 }),
      spool({ id: 'full', purchasedOn: '2026-01-01', remaining: 1000 }),
    ];
    const plan = planDeduction(s, 100, 5);
    expect(plan.missing).toBe(0);
    expect(plan.consumed + plan.purged).toBeCloseTo(105, 10);
    expect(plan.movements[0]).toEqual({ spoolId: 'open', kind: 'consumption', grams: -30 });
    expect(plan.movements.filter((m) => m.spoolId === 'full').reduce((a, m) => a + m.grams, 0)).toBeCloseTo(-75, 10);
  });

  it('empty filament: nothing recorded, still reports what is missing', () => {
    const plan = planDeduction([spool({ id: 'x', remaining: 0 })], 100, 5);
    expect(plan.movements).toEqual([]);
    expect(plan.missing).toBeCloseTo(105, 10);
  });
});

describe('shortfall before producing', () => {
  it('need = g·(1+purge) vs available', () => {
    const out = filamentShortfalls({ f1: 100, f2: 10 }, { f1: 50, f2: 500 }, 5);
    expect(out).toHaveLength(1);
    expect(out[0]!.filamentId).toBe('f1');
    expect(out[0]!.missing).toBeCloseTo(55, 10);
  });
});

describe('status (mockup estFil / rolloEstado)', () => {
  it('maps remaining grams to status', () => {
    expect(filamentStatus([]).status).toBe('no_spools');
    expect(filamentStatus([spool({ id: 'a', remaining: 0.4 })]).status).toBe('out');
    expect(filamentStatus([spool({ id: 'a', remaining: 150 })]).status).toBe('running_out');
    expect(filamentStatus([spool({ id: 'a', remaining: 300 })]).status).toBe('low');
    expect(filamentStatus([spool({ id: 'a', remaining: 960 })]).status).toBe('new');
    expect(filamentStatus([spool({ id: 'a', remaining: 700 })]).status).toBe('normal');
    expect(spoolStatus(spool({ id: 'a', remaining: 0.5 }))).toBe('empty');
    expect(spoolStatus(spool({ id: 'a', remaining: 950 }))).toBe('new');
    expect(spoolStatus(spool({ id: 'a', remaining: 500 }))).toBe('in_use');
  });
});

describe('filament identity', () => {
  it('"PLA  negro" and "pla Negro" are the same filament; accents ignored', () => {
    expect(filamentKey('PLA  negro', ' Café')).toBe(filamentKey('pla Negro', 'cafe'));
  });
});

import { compareFilaments, spoolsForDisplay } from '../src/filament';

describe('display helpers', () => {
  it('sorts filaments by material then color (es)', () => {
    const list = [
      { material: 'PLA Silk', color: 'Morado' },
      { material: 'PLA', color: 'Negro' },
      { material: 'PLA', color: 'Blanco' },
      { material: 'PETG', color: 'Negro' },
    ].sort(compareFilaments);
    expect(list.map((f) => `${f.material} ${f.color}`)).toEqual(['PETG Negro', 'PLA Blanco', 'PLA Negro', 'PLA Silk Morado']);
  });
  it('spools for display: consumption order, then empty newest first; flags the one used first', () => {
    const s = [
      spool({ id: 'empty-old', purchasedOn: '2025-01-01', remaining: 0 }),
      spool({ id: 'full', purchasedOn: '2026-01-01', remaining: 1000 }),
      spool({ id: 'open', purchasedOn: '2026-02-01', remaining: 300 }),
      spool({ id: 'empty-new', purchasedOn: '2025-06-01', remaining: 0 }),
    ];
    const out = spoolsForDisplay(s);
    expect(out.map((x) => x.id)).toEqual(['open', 'full', 'empty-new', 'empty-old']);
    expect(out.filter((x) => x.usedFirst).map((x) => x.id)).toEqual(['open']);
  });
});
