import { describe, expect, it } from 'vitest';
import { averagePrinter, pieceCost, printerForPiece } from '../src/costs';

const settings = { kwhPrice: 3, purgePct: 5, failurePct: 5 };
const printer = { cost: 6000, lifeHours: 3000, maintenancePerHour: 0.5, kw: 0.15 };

describe('Caso 2.1 — cost of a piece', () => {
  it('50 g at $0.50/g · 2 h · printer $6 000/3 000 h/$0.50 h/0.15 kW · extras $2', () => {
    const c = pieceCost({ hours: 2, filaments: [{ grams: 50, costPerGram: 0.5 }], supplies: [], extras: 2, printer }, settings);
    expect(c.M).toBeCloseTo(26.25, 10);
    expect(c.L).toBeCloseTo(0.9, 10);
    expect(c.Q).toBeCloseTo(5, 10);
    expect(c.E).toBeCloseTo(2, 10);
    expect(c.sub).toBeCloseTo(34.15, 10);
    expect(c.total).toBeCloseTo(35.9474, 4);
    expect(c.F).toBeCloseTo(c.total - 34.15, 10);
  });
  it('supplies enter E', () => {
    const c = pieceCost({ hours: 0, filaments: [], supplies: [{ qty: 2, cost: 1.5 }], extras: 1, printer }, { ...settings, failurePct: 0 });
    expect(c.E).toBe(4);
    expect(c.total).toBe(4);
  });
});

describe('printer average ("cualquiera")', () => {
  it('averages cost/life + maintenance and kW; life 1, maintenance 0', () => {
    const avg = averagePrinter([printer, { cost: 3000, lifeHours: 1000, maintenancePerHour: 1, kw: 0.25 }]);
    expect(avg).toEqual({ cost: (2.5 + 4) / 2, lifeHours: 1, maintenancePerHour: 0, kw: 0.2 });
  });
  it('no printers → all 0', () => {
    expect(averagePrinter([])).toEqual({ cost: 0, lifeHours: 1, maintenancePerHour: 0, kw: 0 });
  });
  it('a missing printer id falls back to the average', () => {
    expect(printerForPiece('gone', [{ id: 'p1', ...printer }])).toEqual(averagePrinter([printer]));
    expect(printerForPiece('p1', [{ id: 'p1', ...printer }])).toMatchObject(printer);
  });
});
