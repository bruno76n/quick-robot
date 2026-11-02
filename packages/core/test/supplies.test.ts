import { describe, expect, it } from 'vitest';
import { isTechnicalMaterial, toMinutes } from '../src/defaults';
import { planSupplyMovement, supplyStatus, supplyStock, unitCostAfterPurchase } from '../src/supplies';

describe('supplies (04 §9)', () => {
  it('stock = Σ movements', () => {
    expect(supplyStock([{ qty: 100 }, { qty: -22 }, { qty: 2 }])).toBe(80);
  });
  it('status: out ≤ 0, low ≤ minimum, else enough', () => {
    expect(supplyStatus(0, 10)).toBe('out');
    expect(supplyStatus(10, 10)).toBe('low');
    expect(supplyStatus(11, 10)).toBe('enough');
  });
  it('purchase updates unit cost = total / qty (cents)', () => {
    expect(unitCostAfterPurchase(0.5, 200, 110)).toBe(0.55);
    expect(unitCostAfterPurchase(0.5, 3, 10)).toBe(3.33);
    expect(unitCostAfterPurchase(0.5, 200, 0)).toBe(0.5);
  });
  it('use / waste take out; adjustment sets the real count', () => {
    expect(planSupplyMovement('use', 5, 12)).toEqual({ ok: true, delta: -5 });
    expect(planSupplyMovement('adjustment', 9, 12)).toEqual({ ok: true, delta: -3 });
    expect(planSupplyMovement('adjustment', 20, 12)).toEqual({ ok: true, delta: 8 });
    expect(planSupplyMovement('adjustment', 12, 12)).toEqual({ ok: false, reason: 'no_change' });
    expect(planSupplyMovement('waste', 13, 12)).toEqual({ ok: false, reason: 'insufficient' });
    expect(planSupplyMovement('use', 0, 12)).toEqual({ ok: false, reason: 'invalid_qty' });
  });
});

describe('defaults', () => {
  it('technical materials', () => {
    expect(isTechnicalMaterial('PETG')).toBe(true);
    expect(isTechnicalMaterial('TPU 95A')).toBe(true);
    expect(isTechnicalMaterial('PLA Silk')).toBe(false);
  });
  it('h + min → minutes', () => {
    expect(toMinutes(1, 20)).toBe(80);
    expect(toMinutes(0.3, 0)).toBe(18);
  });
});
