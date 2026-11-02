import { describe, expect, it } from 'vitest';
import { investmentRecovered, maintenanceState } from '../src/printers';
import { countDelta, supplyStatus } from '../src/supplies';

describe('printers', () => {
  it('case 11.1: nozzle every 300 h from 0 h → 240 h Pronto, 300 h Toca ya', () => {
    expect(maintenanceState({ everyHours: 300, lastHours: 0 }, 240)).toEqual({ remaining: 60, usage: 0.8, status: 'soon' });
    expect(maintenanceState({ everyHours: 300, lastHours: 0 }, 300).status).toBe('due');
    expect(maintenanceState({ everyHours: 300, lastHours: 0 }, 100).status).toBe('ok');
    expect(maintenanceState({ everyHours: 300, lastHours: 0 }, 500).usage).toBe(1.2);
  });

  it('case 11.2: gross $5,000 − expenses $1,000 → net $4,000; 100 h and 300 h → $1,000 (16.7 %) and $3,000 (50 %)', () => {
    const r = investmentRecovered(5000, 1000, [{ id: '1', costPesos: 6000, hours: 100 }, { id: '2', costPesos: 6000, hours: 300 }]);
    expect(r.net).toBe(4000);
    expect(r.perPrinter[0]!.contribution).toBe(1000);
    expect(r.perPrinter[0]!.pct).toBeCloseTo(16.7, 1);
    expect(r.perPrinter[1]!).toMatchObject({ contribution: 3000, pct: 50 });
    expect(r.recoveredPct).toBeCloseTo(33.33, 2);
  });

  it('no negative net, no hours, no cost', () => {
    const r = investmentRecovered(100, 500, [{ id: '1', costPesos: 0, hours: 0 }]);
    expect(r).toMatchObject({ net: 0, recoveredPct: 0 });
    expect(r.perPrinter[0]).toEqual({ id: '1', contribution: 0, pct: 0 });
  });
});

describe('supplies', () => {
  it('status: Agotado ≤ 0, Poco ≤ minimum, else Suficiente', () => {
    expect(supplyStatus(0, 5)).toBe('out');
    expect(supplyStatus(5, 5)).toBe('low');
    expect(supplyStatus(6, 5)).toBe('ok');
    expect(countDelta(12, 10)).toBe(-2);
  });
});
