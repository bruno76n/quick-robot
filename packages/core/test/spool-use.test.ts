// Which spool is used, finish and weigh (docs/04 §1, cases 1.2, 1.5a–c and 1.6; ronda-4 §2.5–2.7).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { filamentShortfall, finishSpool, planDeduction, planSpoolUse, spoolRemaining, spoolUseOrder, suggestedSpool, weighSpool } from '../src/filament';
import { aSpool } from './builders';

describe('which spool is used without a choice (docs/04 §1, case 1.2)', () => {
  it('without a choice: the opened spool first, then the oldest, ties by number (then id)', () => {
    const fullOld = aSpool({ id: 'b', number: 2, purchasedOn: '2026-01-01', remaining: 1000 });
    const opened = aSpool({ id: 'c', number: 5, purchasedOn: '2026-06-01', remaining: 400 });
    const fullOldTie = aSpool({ id: 'z', number: 1, purchasedOn: '2026-01-01', remaining: 1000 });
    const empty = aSpool({ id: 'd', remaining: 0 });
    const deleted = aSpool({ id: 'e', remaining: 300, deleted: true });
    expect(spoolUseOrder([fullOld, opened, fullOldTie, empty, deleted]).map((s) => s.id)).toEqual(['c', 'z', 'b']);
  });

  it('suggested spool = the first of that order that is not empty', () => {
    const almostEmpty = aSpool({ id: 'x', number: 1, remaining: 0.4 });
    const opened = aSpool({ id: 'y', number: 2, remaining: 400 });
    expect(suggestedSpool([opened, almostEmpty])?.id).toBe('y');
    expect(suggestedSpool([almostEmpty])).toBeUndefined();
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

});

describe('which spool is used with a choice (docs/04 §1, cases 1.5a–c)', () => {
  const s7 = (remaining: number) => aSpool({ id: 's7', number: 7, purchasedOn: '2026-09-15', grams: 1000, remaining, noCost: true });
  const s5 = () => aSpool({ id: 's5', number: 5, purchasedOn: '2026-10-10', grams: 1000, remaining: 640 });
  const s9 = () => aSpool({ id: 's9', number: 9, purchasedOn: '2026-11-05', grams: 1000, remaining: 1000 });

  it('case 1.5a (2.5a): purge 5 %, 50 g piece from #7 with 100 g → 52.5 g; #7 100 → 47.5 (consumption 50.0, purge 2.5)', () => {
    const r = planSpoolUse([s7(100), s5(), s9()], 50, 5, [{ spoolId: 's7', grams: 52.5 }]);
    expect(r).toEqual({ ok: true, movements: [{ spoolId: 's7', kind: 'consumption', grams: -50 }, { spoolId: 's7', kind: 'waste', grams: -2.5 }], taken: 52.5, missing: 0 });
    expect(planDeduction([s7(100), s5(), s9()], 50, 5).movements).toEqual(r.ok ? r.movements : []);
  });

  it('case 1.5b (2.5b): #7 has 30 g, «#7 what it has + the rest from #5» → #7 30 → 0 (28.6 + 1.4); #5 640 → 617.5 (21.4 + 1.1)', () => {
    const expected = {
      ok: true, taken: 52.5, missing: 0, movements: [
        { spoolId: 's7', kind: 'consumption', grams: -28.6 }, { spoolId: 's7', kind: 'waste', grams: -1.4 },
        { spoolId: 's5', kind: 'consumption', grams: -21.4 }, { spoolId: 's5', kind: 'waste', grams: -1.1 },
      ],
    };
    expect(planSpoolUse([s9(), s5(), s7(30)], 50, 5, [{ spoolId: 's7' }, { spoolId: 's5' }])).toEqual(expected);
    expect(planSpoolUse([s9(), s5(), s7(30)], 50, 5, [{ spoolId: 's7', grams: 30 }, { spoolId: 's5', grams: 22.5 }])).toEqual(expected);
    // Only #7 chosen: the rest comes from the other spools in the automatic order (#5 is opened).
    expect(planSpoolUse([s9(), s5(), s7(30)], 50, 5, [{ spoolId: 's7' }])).toEqual(expected);
  });

  it('case 1.5c (2.5c): 20 pieces of 45 g, purge 5 % → 945 g; starts with #4 (410 g) → 0, then #13 1,000 → 465', () => {
    const s4 = aSpool({ id: 's4', number: 4, purchasedOn: '2026-10-01', remaining: 410 });
    const s13 = aSpool({ id: 's13', number: 13, purchasedOn: '2026-11-01', remaining: 1000 });
    const r = planSpoolUse([s13, s4], 20 * 45, 5, [{ spoolId: 's4' }]);
    expect(r.ok && r.movements).toEqual([
      { spoolId: 's4', kind: 'consumption', grams: -390.5 }, { spoolId: 's4', kind: 'waste', grams: -19.5 },
      { spoolId: 's13', kind: 'consumption', grams: -509.5 }, { spoolId: 's13', kind: 'waste', grams: -25.5 },
    ]);
    const left = (id: string, start: number) => spoolRemaining([start, ...(r.ok ? r.movements : []).filter((m) => m.spoolId === id).map((m) => m.grams)]);
    expect([left('s4', 410), left('s13', 1000)]).toEqual([0, 465]);
  });

  it('SPOOL_INSUFFICIENT when a part is more than the spool has; SPOOL_NOT_IN_FILAMENT for a spool that is not of this filament', () => {
    expect(planSpoolUse([s7(30), s5()], 50, 5, [{ spoolId: 's7', grams: 52.5 }])).toEqual({ ok: false, code: 'SPOOL_INSUFFICIENT', spoolId: 's7', availableGrams: 30 });
    expect(planSpoolUse([s7(30), s5()], 50, 5, [{ spoolId: 's7', grams: 30.04 }]).ok).toBe(true);
    expect(planSpoolUse([s7(30), s5()], 50, 5, [{ spoolId: 'other' }])).toEqual({ ok: false, code: 'SPOOL_NOT_IN_FILAMENT', spoolId: 'other' });
    expect(planSpoolUse([s7(30), aSpool({ id: 'gone', remaining: 500, deleted: true })], 50, 5, [{ spoolId: 'gone' }]).ok).toBe(false);
  });

  it('chosen parts that cover more than needed are capped; the shortfall stays as today', () => {
    const r = planSpoolUse([s7(100), s5()], 50, 5, [{ spoolId: 's5', grams: 80 }]);
    expect(r.ok && r.taken).toBe(52.5);
    expect(r.ok && r.movements.every((m) => m.spoolId === 's5')).toBe(true);
    const short = planSpoolUse([s7(10), aSpool({ id: 'q', remaining: 20 })], 50, 5, [{ spoolId: 's7', grams: 5 }]);
    expect(short).toMatchObject({ ok: true, taken: 30, missing: 22.5 });
  });

  it('a chosen spool still gives what it has left after the others ran out', () => {
    const r = planSpoolUse([s7(100), aSpool({ id: 'q', remaining: 10 })], 50, 5, [{ spoolId: 's7', grams: 20 }]);
    expect(r).toMatchObject({ ok: true, taken: 52.5, missing: 0 });
    const by = (id: string) => (r.ok ? r.movements : []).filter((m) => m.spoolId === id).reduce((a, m) => a + m.grams, 0);
    expect([Math.round(by('s7') * 10) / 10, by('q')]).toEqual([-42.5, -10]);
  });

});

describe('deduction details', () => {
  it('splits across spools in the automatic order and nothing is missing when it fits', () => {
    const a = aSpool({ id: 'a', remaining: 30 });
    const b = aSpool({ id: 'b', remaining: 1000 });
    const d = planDeduction([a, b], 100, 5);
    expect(d.taken).toBe(105);
    expect(d.missing).toBe(0);
    expect(d.movements).toEqual([
      { spoolId: 'a', kind: 'consumption', grams: -28.6 }, { spoolId: 'a', kind: 'waste', grams: -1.4 },
      { spoolId: 'b', kind: 'consumption', grams: -71.4 }, { spoolId: 'b', kind: 'waste', grams: -3.6 },
    ]);
  });

  it('nothing to take when there is nothing or nothing asked; no purge → no waste movement', () => {
    expect(planDeduction([aSpool({ remaining: 0 })], 10, 5)).toEqual({ movements: [], taken: 0, missing: 10.5 });
    expect(planDeduction([aSpool()], 0, 5)).toEqual({ movements: [], taken: 0, missing: 0 });
    expect(planSpoolUse([aSpool({ id: 'n' })], 10, 0).ok && planDeduction([aSpool({ id: 'n' })], 10, 0).movements).toEqual([{ spoolId: 'n', kind: 'consumption', grams: -10 }]);
  });

  it('shortfall before producing', () => {
    expect(filamentShortfall(100, 5, 50)).toBe(55);
    expect(filamentShortfall(100, 5, 105)).toBe(0);
  });

  it('property: a spool never ends negative and consumption + purge = what was taken, whatever the jobs and choices', () => {
    fc.assert(fc.property(
      fc.array(fc.double({ min: 0, max: 1200, noNaN: true }), { minLength: 1, maxLength: 4 }),
      fc.array(fc.tuple(fc.double({ min: 0.1, max: 800, noNaN: true }), fc.integer({ min: -1, max: 3 })), { maxLength: 8 }),
      fc.integer({ min: 0, max: 20 }),
      (lefts, jobs, purge) => {
        let spools = lefts.map((r, i) => aSpool({ id: `p${i}`, number: i + 1, remaining: Math.round(r * 10) / 10 }));
        for (const [g, pick] of jobs) {
          const chosen = spools[pick];
          const r = planSpoolUse(spools, g, purge, chosen ? [{ spoolId: chosen.id }] : []);
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          expect(Math.round(-r.movements.reduce((a, m) => a + m.grams, 0) * 10) / 10 || 0).toBe(r.taken);
          spools = spools.map((s) => ({ ...s, remaining: spoolRemaining([s.remaining, ...r.movements.filter((m) => m.spoolId === s.id).map((m) => m.grams)]) }));
          for (const s of spools) expect(s.remaining).toBeGreaterThanOrEqual(0);
        }
      },
    ));
  });
});

describe('finish and weigh a spool (ronda-4 2.6 and 2.7)', () => {
  it('finish: a waste movement for all that is left; already empty (≤ 0.5 g) → SPOOL_ALREADY_EMPTY', () => {
    expect(finishSpool({ remaining: 47.5 })).toEqual({ ok: true, grams: -47.5 });
    expect(finishSpool({ remaining: 0.6 })).toEqual({ ok: true, grams: -0.6 });
    expect(finishSpool({ remaining: 0.5 })).toEqual({ ok: false, code: 'SPOOL_ALREADY_EMPTY' });
    expect(finishSpool({ remaining: -3 })).toEqual({ ok: false, code: 'SPOOL_ALREADY_EMPTY' });
  });

  it('case 1.6 (2.7): #7 of 1,000 g with 100 g; scale 348 g, Bambu Lab tare 248 g → 100 g, no movement; scale 330 g → 82 g, adjustment −18 g', () => {
    const s = { grams: 1000, remaining: 100 };
    expect(weighSpool(s, 348, 248)).toEqual({ ok: true, leftGrams: 100, adjustmentGrams: null });
    expect(weighSpool(s, 330, 248)).toEqual({ ok: true, leftGrams: 82, adjustmentGrams: -18 });
    expect(weighSpool({ grams: 1000, remaining: 99.96 }, 348, 248)).toEqual({ ok: true, leftGrams: 100, adjustmentGrams: null });
  });

  it('valid only if 0 ≤ left ≤ grams × 1.05; otherwise WEIGHT_OUT_OF_RANGE with the maximum', () => {
    const s = { grams: 1000, remaining: 100 };
    expect(weighSpool(s, 1298, 248)).toMatchObject({ ok: true, leftGrams: 1050, adjustmentGrams: 950 });
    expect(weighSpool(s, 1298.2, 248)).toEqual({ ok: false, code: 'WEIGHT_OUT_OF_RANGE', maxGrams: 1050 });
    expect(weighSpool(s, 248, 248)).toEqual({ ok: true, leftGrams: 0, adjustmentGrams: -100 });
    expect(weighSpool(s, 200, 248)).toEqual({ ok: false, code: 'WEIGHT_OUT_OF_RANGE', maxGrams: 1050 });
    expect(weighSpool(s, Number.NaN, 248)).toMatchObject({ ok: false });
  });
});
