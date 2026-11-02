import { describe, expect, it } from 'vitest';
import { investmentRecovery, maintenanceStatus } from '../src/printers';

describe('Caso 11.1 — maintenance', () => {
  const nozzle = { everyHours: 300, lastHours: 0 };
  it('at 240 h → usage 0.8, remaining 60 → soon', () => {
    expect(maintenanceStatus(240, nozzle)).toEqual({ remaining: 60, usage: 0.8, status: 'soon' });
  });
  it('at 300 h → remaining 0 → due', () => {
    expect(maintenanceStatus(300, nozzle).status).toBe('due');
  });
  it('early → ok; usage clamped to 1.2', () => {
    expect(maintenanceStatus(100, nozzle).status).toBe('ok');
    expect(maintenanceStatus(900, nozzle).usage).toBe(1.2);
  });
});

describe('Caso 11.2 — investment recovered', () => {
  it('gross $5 000, expenses $1 000 → net $4 000; contributions $1 000 and $3 000 → 16.7 % and 50 %', () => {
    const r = investmentRecovery(5000, 1000, [
      { id: 'p1', cost: 6000, hours: 100 },
      { id: 'p2', cost: 6000, hours: 300 },
    ]);
    expect(r.net).toBe(4000);
    expect(r.perPrinter[0]!.contribution).toBe(1000);
    expect(r.perPrinter[1]!.contribution).toBe(3000);
    expect(r.perPrinter[0]!.pct).toBeCloseTo(16.7, 1);
    expect(r.perPrinter[1]!.pct).toBe(50);
  });
  it('net never negative', () => {
    expect(investmentRecovery(100, 500, [{ id: 'p', cost: 10, hours: 1 }]).net).toBe(0);
  });
});
