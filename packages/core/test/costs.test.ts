import { describe, expect, it } from 'vitest';
import { averagePrinter, costProduct } from '../src/costs';

const settings = { kwhPrice: 3, purgePct: 5, failurePct: 5 };
const printer = { costPesos: 6000, lifeHours: 3000, maintenancePerHour: 0.5, kw: 0.15 };

describe('cost of a piece', () => {
  it('case 2.1: M 26.25 · L 0.90 · Q 5.00 · E 2.00 · sub 34.15 · cost 35.9474', () => {
    const c = costProduct({ hours: 2, extras: 2, printer, filaments: [{ grams: 50, costPerGram: 0.5 }], supplies: [] }, [printer], settings);
    expect(c.M).toBeCloseTo(26.25, 10);
    expect(c.L).toBeCloseTo(0.9, 10);
    expect(c.Q).toBeCloseTo(5, 10);
    expect(c.E).toBeCloseTo(2, 10);
    expect(c.sub).toBeCloseTo(34.15, 10);
    expect(c.total).toBeCloseTo(35.9474, 4);
    expect(c.F).toBeCloseTo(35.9474 - 34.15, 4);
  });

  it('supplies count in E at their cost', () => {
    const c = costProduct({ hours: 0, extras: 1, printer, filaments: [], supplies: [{ qty: 2, unitCost: 0.5 }] }, [], { ...settings, failurePct: 0 });
    expect(c.E).toBe(2);
    expect(c.total).toBe(2);
  });

  it('average printer: (cost/life + maintenance) and kW averaged; none → zeros', () => {
    const other = { costPesos: 3000, lifeHours: 1000, maintenancePerHour: 1, kw: 0.25 };
    expect(averagePrinter([printer, other])).toEqual({ costPesos: (2.5 + 4) / 2, lifeHours: 1, maintenancePerHour: 0, kw: 0.2 });
    expect(averagePrinter([])).toEqual({ costPesos: 0, lifeHours: 1, maintenancePerHour: 0, kw: 0 });
    const c = costProduct({ hours: 2, extras: 0, printer: null, filaments: [], supplies: [] }, [printer, other], { ...settings, failurePct: 0 });
    expect(c.Q).toBeCloseTo(2 * 3.25, 10);
    expect(c.L).toBeCloseTo(2 * 0.2 * 3, 10);
  });
});
