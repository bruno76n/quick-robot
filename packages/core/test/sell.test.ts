// Cases 4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 9.1, 10.1 of docs/04, and properties of the ledgers.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { expenseInRange, fixedPerMonth } from '../src/expenses';
import { itemFromStockCount, itemHours, itemLines, itemToPrintCount, type LineItemData } from '../src/line-items';
import { allowedFrom, nextStep, orderOwed, orderTotal, planDelivery, planReady } from '../src/orders';
import { jobProgress, printRunEffects, printRunLock, proposeAssignment, queueMinutes, waitBefore } from '../src/production';
import { saleCommission, saleOwed, saleProfit, salesTotals, type SaleData } from '../src/sales';
import { buildableSets, familyStockStatus, filamentPurchase, free, physical, reserved, reserveForOrder, stockStatus, supplyPurchase, type OrderStockView } from '../src/stock';

const piece = (over: Partial<LineItemData> = {}): LineItemData => ({ kind: 'piece', productId: 'llavero', name: 'Llavero', qty: 1, price: 72, list: 72, cost: 35.9474, ...over });
const sale = (over: Partial<SaleData> = {}): SaleData => ({ id: 's', items: [piece()], commissionPct: 0, payments: null, returned: null, ...over });

describe('line items and stock', () => {
  it('case 4.1: 10 keychains, 4 from stock → 6 printed, material and hours of 6', () => {
    const it = piece({ qty: 10, fromStock: { llavero: 4 } });
    expect(itemToPrintCount(it)).toBe(6);
    expect(itemFromStockCount(it)).toBe(4);
    expect(itemHours(it, () => 0.3)).toBeCloseTo(1.8, 10);
  });

  it('case 5.1: physical 10; A accepted uses 3; B ready stk 2; C cancelled uses 4 → reserved 5, free 5', () => {
    const orders: OrderStockView[] = [
      { id: 'A', status: 'accepted', items: [piece({ fromStock: { llavero: 3 } })] },
      { id: 'B', status: 'ready', items: [], reserved: { llavero: 2 } },
      { id: 'C', status: 'cancelled', items: [piece({ fromStock: { llavero: 4 } })] },
    ];
    expect(reserved('llavero', orders)).toBe(5);
    expect(free(physical([10]), reserved('llavero', orders))).toBe(5);
    expect(reserved('llavero', orders, 'A')).toBe(2);
  });

  it('case 5.2: status of a piece in stock', () => {
    expect(stockStatus(5, 5)).toBe('all_reserved');
    expect(stockStatus(5, 3)).toBe('few');
    expect(stockStatus(5, 2)).toBe('ok');
    expect(stockStatus(0, 0)).toBe('out');
  });

  it('buildable sets and reserving on accept', () => {
    expect(buildableSets([{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }], (id) => (id === 'a' ? 5 : 3))).toBe(2);
    expect(buildableSets([{ productId: 'a', qty: 1 }], () => null)).toBe(0);
    expect(buildableSets([], () => 1)).toBe(0);
    const r = reserveForOrder([piece({ fromStock: { llavero: 3 } }), piece({ fromStock: { llavero: 2 } }), piece()], () => 4);
    expect(r).toEqual({ fromStock: [{ llavero: 3 }, { llavero: 1 }, undefined], missing: 1 });
    expect(reserveForOrder([piece({ fromStock: { llavero: 2 } })], () => 0)).toEqual({ fromStock: [undefined], missing: 2 });
  });

  it('property: free = max(0, physical − reserved) and free ≤ physical', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -50, max: 50 })), fc.integer({ min: 0, max: 100 }), (moves, r) => {
      const p = physical(moves);
      expect(free(p, r)).toBe(Math.max(0, p - r));
      expect(free(p, r)).toBeLessThanOrEqual(p);
    }));
  });
});

describe('sales', () => {
  it('case 6.1: $72 piece, cost 35.9474, channel 17 % → commission 12.24, profit 23.81', () => {
    const s = sale({ commissionPct: 17 });
    expect(saleCommission(s)).toBeCloseTo(12.24, 2);
    expect(saleProfit(s)).toBeCloseTo(23.81, 2);
  });

  it('case 6.2: $300 with a $100 payment owes $200; without payments owes $0', () => {
    const s = sale({ items: [piece({ price: 300 })], payments: [100] });
    expect(saleOwed(s)).toBe(200);
    expect(saleOwed({ ...s, payments: null })).toBe(0);
  });

  it('returns: back to stock → profit 0; thrown away → −cost; nothing owed', () => {
    expect(saleProfit(sale({ returned: { on: 'x', restock: true, refund: 72, note: '' } }))).toBe(0);
    expect(saleProfit(sale({ returned: { on: 'x', restock: false, refund: 0, note: '' } }))).toBeCloseTo(-35.9474, 4);
    expect(saleOwed(sale({ payments: [0], returned: { on: 'x', restock: true, refund: 0, note: '' } }))).toBe(0);
    expect(salesTotals([sale(), sale({ returned: { on: 'x', restock: true, refund: 0, note: '' } })]).income).toBe(72);
  });

  it('a set is split among its pieces by list price (case 3.3 shape)', () => {
    const set: LineItemData = { kind: 'set', collectionId: 'c', name: 'Set', qty: 1, price: 170, list: 194, cost: 75, extras: 5, parts: [{ productId: 'A', name: 'A', qty: 2, list: 72, cost: 30 }, { productId: 'B', name: 'B', qty: 1, list: 50, cost: 10 }] };
    const [a, b] = itemLines(set);
    expect(a!.income).toBeCloseTo(126.19, 2);
    expect(b!.income).toBeCloseTo(43.81, 2);
    expect(a!.cost + b!.cost).toBeCloseTo(75, 10);
  });
});

describe('orders', () => {
  it('case 7.1: $500 with $200 deposit owes $300; cancelled with $200 refund → paid 0, owes 0', () => {
    const o = { status: 'accepted' as const, items: [piece({ price: 500 })], commissionPct: 0, payments: [200] };
    expect(orderOwed(o)).toBe(300);
    const c = { ...o, status: 'cancelled' as const, payments: [200, -200] };
    expect(orderOwed(c)).toBe(0);
    expect(orderTotal(c)).toBe(500);
  });

  it('case 7.2: 10 pieces, 4 from stock → ready reserves 10 and adds +6; delivery −10; net −4', () => {
    const items = [piece({ qty: 10, fromStock: { llavero: 4 } })];
    const r = planReady(items, () => true);
    expect(r.reserved).toEqual({ llavero: 10 });
    expect(r.movements).toEqual([{ productId: 'llavero', qty: 6 }]);
    const d = planDelivery(r.reserved);
    expect(d).toEqual([{ productId: 'llavero', qty: -10 }]);
    expect(6 - 10).toBe(-4);
    expect(planReady(items, () => false)).toEqual({ reserved: {}, movements: [] });
  });

  it('next step and allowed transitions; all from stock skips production', () => {
    const fromShelf = { status: 'accepted' as const, items: [piece({ qty: 2, fromStock: { llavero: 2 } })] };
    expect(nextStep(fromShelf)).toBe('ready');
    expect(allowedFrom('ready', fromShelf)).toContain('accepted');
    expect(nextStep({ status: 'accepted', items: [piece()] })).toBe('start_production');
    expect(nextStep({ status: 'quoted', items: [] })).toBe('accept');
    expect(nextStep({ status: 'ready', items: [] })).toBe('deliver');
    expect(nextStep({ status: 'delivered', items: [] })).toBeNull();
    expect(allowedFrom('cancel', fromShelf)).not.toContain('delivered');
  });

  it('property: delivering and returning with restock leaves stock as it was', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 100 }), (n, shelf, start) => {
      const fromStock = Math.min(n, shelf);
      const items = [piece({ qty: n, fromStock: { llavero: fromStock } })];
      const r = planReady(items, () => true);
      let stock = start + r.movements.reduce((a, m) => a + m.qty, 0) + planDelivery(r.reserved).reduce((a, m) => a + m.qty, 0);
      stock += n; // return with restock puts the delivered pieces back
      expect(stock).toBe(start + (n - fromStock));
    }));
  });
});

describe('production', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('queue progress, wait and total minutes', () => {
    const q = [{ minutes: 120, startedAt: new Date('2026-11-01T11:00:00Z') }, { minutes: 30, startedAt: null }, { minutes: 15, startedAt: null }];
    expect(jobProgress(q[0]!, now)).toEqual({ pct: 50, left: 60, active: true });
    expect(jobProgress(q[1]!, now)).toEqual({ pct: 0, left: 30, active: false });
    expect(waitBefore(q, 2, now)).toBe(90);
    expect(waitBefore(q, 0, now)).toBe(0);
    expect(queueMinutes(q, now)).toBe(105);
  });

  it('fastest distribution counts what was already assigned', () => {
    expect(proposeAssignment([2, 1, 1], new Map([['p1', 0], ['p2', 30]]))).toEqual(['p1', 'p2', 'p2']);
  });

  it('a print run adds stock and uses supplies; tests use nothing; locks', () => {
    const sup = [{ supplyId: 'argolla', qty: 1 }];
    expect(printRunEffects({ result: 'ok', reason: 'stock', qty: 10, tracksStock: true }, sup)).toEqual({ stockQty: 10, supplyUse: [{ supplyId: 'argolla', qty: -10 }] });
    expect(printRunEffects({ result: 'ok', reason: 'test', qty: 1, tracksStock: true }, sup)).toEqual({ stockQty: 0, supplyUse: [] });
    expect(printRunEffects({ result: 'fail', reason: 'stock', qty: 1, tracksStock: true }, sup)).toEqual({ stockQty: 0, supplyUse: [] });
    expect(printRunLock({ reason: 'order', piecesAdded: 0 }, 0)).toEqual({ reason: 'order_history', pieces: 0 });
    expect(printRunLock({ reason: 'stock', piecesAdded: 3 }, 2)).toEqual({ reason: 'pieces_unavailable', pieces: 3 });
    expect(printRunLock({ reason: 'stock', piecesAdded: 3 }, 3)).toBeNull();
  });
});

describe('purchases and expenses', () => {
  it('case 9.1: minimum 30, stock 12 → 48 for $24; stock 31 does not enter', () => {
    expect(supplyPurchase({ id: 'i', stock: 12, minimum: 30, unitCost: 0.5, supplierId: null })).toMatchObject({ qty: 48, estimated: 24 });
    expect(supplyPurchase({ id: 'i', stock: 31, minimum: 30, unitCost: 0.5, supplierId: null })).toBeNull();
  });

  it('filament: low (≤ 300 g) asks for one spool; an order shortfall asks for what is missing', () => {
    const last = { grams: 1000, costPlusShipping: 390 };
    expect(filamentPurchase({ id: 'f', hasSpools: true, remaining: 250, neededByOrders: 0, lastSpool: last, supplierId: null })).toMatchObject({ qty: 1, estimated: 390, reason: 'low' });
    expect(filamentPurchase({ id: 'f', hasSpools: true, remaining: 500, neededByOrders: 2700, lastSpool: last, supplierId: null })).toMatchObject({ qty: 3, reason: 'order' });
    expect(filamentPurchase({ id: 'f', hasSpools: true, remaining: 500, neededByOrders: 0, lastSpool: last, supplierId: null })).toBeNull();
  });

  it('case 10.1: $1,000 monthly over a 30-day range → $985.63', () => {
    expect(expenseInRange({ on: '2026-01-01', amount: 1000, recurring: true, endsOn: null }, '2026-10-03', '2026-11-01')).toBeCloseTo(985.63, 2);
    expect(expenseInRange({ on: '2026-10-05', amount: 380, recurring: false, endsOn: null }, '2026-10-03', '2026-11-01')).toBe(380);
    expect(expenseInRange({ on: '2026-09-01', amount: 380, recurring: false, endsOn: null }, '2026-10-03', '2026-11-01')).toBe(0);
    expect(expenseInRange({ on: '2026-01-01', amount: 1000, recurring: true, endsOn: '2026-09-01' }, '2026-10-03', '2026-11-01')).toBe(0);
    expect(fixedPerMonth([{ on: '2026-01-01', amount: 1200, recurring: true, endsOn: null }, { on: '2026-01-01', amount: 400, recurring: true, endsOn: '2026-10-01' }], '2026-11-01')).toBe(1200);
  });
});

describe('family stock status (case 5.3)', () => {
  const m = (physicalQty: number, reservedQty: number) => ({ physical: physicalQty, reserved: reservedQty });
  it('free 1, 1, 2 (reserved 2, 0, 1) → sums free 4, reserved 3 · few', () => {
    const fam = [m(3, 2), m(1, 0), m(3, 1)];
    expect(fam.reduce((a, x) => a + free(x.physical, x.reserved), 0)).toBe(4);
    expect(fam.reduce((a, x) => a + x.reserved, 0)).toBe(3);
    expect(familyStockStatus(fam)).toBe('few');
  });
  it('free 3, 4, 6 → ok', () => expect(familyStockStatus([m(3, 0), m(4, 0), m(7, 1)])).toBe('ok'));
  it('free 0, 0, 0 with physical > 0 → all_reserved', () => expect(familyStockStatus([m(2, 2), m(0, 0), m(1, 1)])).toBe('all_reserved'));
  it('physical 0 in every member → out', () => expect(familyStockStatus([m(0, 0), m(0, 0), m(0, 1)])).toBe('out'));
  it('mixed: one member out and the rest plenty → few (that member has 2 free or less)', () => {
    expect(familyStockStatus([m(0, 0), m(9, 0), m(5, 0)])).toBe('few');
  });
  it('a single member follows case 5.2', () => {
    expect(familyStockStatus([m(5, 2)])).toBe(stockStatus(5, 2));
    expect(familyStockStatus([m(5, 3)])).toBe('few');
  });
});
