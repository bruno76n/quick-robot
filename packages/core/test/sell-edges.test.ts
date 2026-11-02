// Edges of the phase 3 rules that the numeric cases do not reach.
import { describe, expect, it } from 'vitest';
import { customerStats } from '../src/customers';
import { itemLines, itemMaterial, type LineItemData } from '../src/line-items';
import { allowedFrom, isActive, nextStep, orderCommission, orderCost, orderPieces, orderProfit, type OrderData } from '../src/orders';
import { report } from '../src/reports';
import { rankProducts, saleCost, saleIncome, saleList, saleOwed, salePieces, salesTotals, soldCounts, type SaleData } from '../src/sales';
import { buildableSets, orderNeed, reserveForOrder } from '../src/stock';

const piece = (over: Partial<LineItemData> = {}): LineItemData => ({ kind: 'piece', productId: 'a', name: 'A', qty: 2, price: 50, list: 60, cost: 10, ...over });
const set = (over: Partial<LineItemData> = {}): LineItemData => ({
  kind: 'set', collectionId: 'c', name: 'Set', qty: 2, price: 300, list: 300, cost: 80, extras: 10,
  parts: [{ productId: 'a', name: 'A', qty: 1, list: 100, cost: 20 }, { productId: 'b', name: 'B', qty: 2, list: 50, cost: 25 }], ...over,
});
const sale = (over: Partial<SaleData> = {}): SaleData => ({ id: 's', items: [piece()], commissionPct: 10, payments: null, returned: null, ...over });
const order = (over: Partial<OrderData> = {}): OrderData => ({ status: 'accepted', items: [piece()], commissionPct: 10, payments: [], ...over });

describe('line items', () => {
  it('a set without parts counts as a single line; parts with no list price split evenly', () => {
    expect(itemLines(set({ parts: [] }))).toEqual([{ productId: 'c', name: 'Set', qty: 2, income: 600, cost: 160 }]);
    const even = itemLines(set({ parts: [{ productId: 'a', name: 'A', qty: 1, list: 0, cost: 1 }, { productId: 'b', name: 'B', qty: 1, list: 0, cost: 1 }] }));
    expect(even.map((l) => l.income)).toEqual([300, 300]);
  });

  it('material of what is printed, per filament', () => {
    const m = itemMaterial(set({ fromStock: { a: 2 } }), (id) => (id === 'b' ? [{ filamentId: 'f', grams: 5 }] : [{ filamentId: 'f', grams: 1 }, { filamentId: 'g', grams: 2 }]));
    expect(m).toEqual({ f: 20 });
    expect(itemMaterial(piece({ productId: null }), () => [])).toEqual({});
  });
});

describe('sales', () => {
  it('a returned sale earns nothing; restocked pieces cost nothing, thrown away ones do', () => {
    const back = sale({ returned: { on: '2026-11-01', restock: true, refund: 100, note: '' } });
    const lost = sale({ returned: { on: '2026-11-01', restock: false, refund: 100, note: '' } });
    expect([saleIncome(back), saleCost(back), saleList(back), salePieces(back), saleOwed(back)]).toEqual([0, 0, 0, 0, 0]);
    expect(saleCost(lost)).toBe(20);
    expect(saleList(sale())).toBe(120);
    expect(salesTotals([]).marginPct).toBe(0);
    expect(rankProducts([back])).toEqual([]);
  });

  it('ranking uses the given names and counts times over cost', () => {
    const r = rankProducts([sale(), sale({ items: [piece({ cost: 0, productId: 'z' })] })], (id) => (id === 'a' ? 'Nombre' : undefined));
    expect(r.find((x) => x.productId === 'a')).toMatchObject({ name: 'Nombre', qty: 2, times: 5 });
    expect(r.find((x) => x.productId === 'z')?.times).toBe(0);
  });

  it('sold counts open sets into pieces and count sets per collection', () => {
    const c = soldCounts([sale({ items: [piece(), set()] }), sale({ items: [set({ collectionId: null })] }), sale({ returned: { on: '', restock: true, refund: 0, note: '' } })]);
    expect(Object.fromEntries(c.products)).toEqual({ a: 6, b: 8 });
    expect(Object.fromEntries(c.collections)).toEqual({ c: 2 });
  });

  it('report per period and channel', () => {
    const list = [
      { ...sale(), on: '2026-11-01', channelId: 'x' },
      { ...sale({ commissionPct: 0, items: [piece({ qty: 10 })] }), on: '2026-10-30', channelId: 'y' },
      { ...sale(), on: '2026-08-01', channelId: 'x' },
    ];
    const r = report(list, '2026-11-01', 7);
    expect(r.totals.income).toBe(600);
    expect(r.byChannel.map((c) => [c.channelId, c.count])).toEqual([['y', 1], ['x', 1]]);
    expect(report(list, '2026-11-01', 'all').totals.income).toBe(700);
  });
});

describe('orders', () => {
  it('commission, cost, profit and pieces', () => {
    const o = order({ items: [piece(), set()] });
    expect([orderCommission(o), orderCost(o), orderProfit(o), orderPieces(o)]).toEqual([70, 180, 450, 8]);
  });

  it('next step and allowed states', () => {
    expect(nextStep(order({ status: 'quoted' }))).toBe('accept');
    expect(nextStep(order())).toBe('start_production');
    expect(nextStep(order({ items: [piece({ fromStock: { a: 2 } })] }))).toBe('ready');
    expect(nextStep(order({ items: [] }))).toBe('start_production');
    expect(nextStep(order({ status: 'in_production' }))).toBe('ready');
    expect(nextStep(order({ status: 'ready' }))).toBe('deliver');
    expect(nextStep(order({ status: 'delivered' }))).toBeNull();
    expect(allowedFrom('accept', order())).toEqual(['quoted']);
    expect(allowedFrom('start_production', order())).toEqual(['accepted']);
    expect(allowedFrom('reassign', order())).toEqual(['in_production']);
    expect(allowedFrom('ready', order())).toEqual(['in_production']);
    expect(allowedFrom('ready', order({ items: [piece({ fromStock: { a: 2 } })] }))).toEqual(['accepted', 'in_production']);
    expect(allowedFrom('deliver', order())).toEqual(['ready']);
    expect(allowedFrom('cancel', order())).toHaveLength(4);
    expect([isActive('ready'), isActive('cancelled'), isActive('delivered')]).toEqual([true, false, false]);
  });

  it('needs of an order and reservation without fromStock', () => {
    expect(orderNeed([piece(), set()])).toEqual({ a: 4, b: 4 });
    expect(reserveForOrder([piece()], () => 5)).toEqual({ fromStock: [undefined], missing: 0 });
    expect(reserveForOrder([piece({ fromStock: { a: 2 } })], () => 0)).toEqual({ fromStock: [undefined], missing: 2 });
    expect(buildableSets([], () => 1)).toBe(0);
    expect(buildableSets([{ productId: 'a', qty: 1 }], () => null)).toBe(0);
  });
});

describe('customers', () => {
  it('without activity there is no last date; owed counts active orders and sales', () => {
    expect(customerStats([], []).lastActivity).toBeNull();
    const c = customerStats(
      [{ ...order({ payments: [40] }), createdOn: '', dueOn: '2026-11-05' }, { ...order({ status: 'delivered' }), createdOn: '2026-10-01', dueOn: '' }],
      [{ ...sale({ payments: [30] }), on: '2026-10-20' }],
    );
    expect(c).toMatchObject({ orders: 2, activeOrders: 1, sales: 1, owed: 130, lastActivity: '2026-11-05' });
  });
});
