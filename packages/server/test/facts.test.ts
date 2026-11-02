// The SQL aggregates (saleFacts, orderFacts, soldTotals) give the same numbers as core on the seeded data.
import { orderFacts, saleFacts, soldTotals } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../src/dev-seed';
import { soldOf } from '../src/usecases/sell/stock';
import { makeHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); await applyDevelopmentSeed(h.deps, h.A); }, 60_000);
afterAll(() => h.close());

describe('SQL aggregates', () => {
  it('sold totals equal core soldCounts', async () => {
    const a = await soldTotals(h.db, h.A);
    const b = await soldOf(h.db, h.A);
    expect(Object.fromEntries(a.products)).toEqual(Object.fromEntries(b.products));
    expect(Object.fromEntries(a.collections)).toEqual(Object.fromEntries(b.collections));
  });
  it('sale and order facts', async () => {
    const s = await saleFacts(h.db, h.A);
    expect(s).toHaveLength(25);
    expect(Math.round(s.reduce((x, r) => x + r.grossCents, 0))).toBe(1317000);
    expect(s.reduce((x, r) => x + r.pieces, 0)).toBe(94);
    expect((await saleFacts(h.db, h.A, { limit: 5, offset: 0 }))).toHaveLength(5);
    const o = await orderFacts(h.db, h.A);
    expect(o.map((x) => x.grossCents / 100)).toEqual([880, 900, 2350, 1750, 2200, 2460, 950]);
  });
});

describe('fast read paths equal the full ones', () => {
  it('sale list and customer totals', async () => {
    const { saleListFast, customerTotals } = await import('../src/usecases/sell/fast');
    const { saleList } = await import('../src/usecases/sell/sales');
    const { customerList } = await import('../src/usecases/sell/customers');
    const f = { page: 1, pageSize: 10 };
    const a = await saleListFast(h.db, h.A, f);
    const b = await saleList(h.deps, h.db, h.A, f);
    expect(a.totals).toMatchObject({ count: 25, incomeCents: 1317000, owedCents: 50000, costCents: 234529, profitCents: 1057523 }); // golden 2345.2935 / 10575.2265
    expect(a.total).toBe(b.total);
    expect(a.items.map((x) => [x.id, x.profitCents, x.owedCents, x.itemsText, x.pieces])).toEqual(b.items.map((x) => [x.id, x.profitCents, x.owedCents, x.itemsText, x.pieces]));
    const q = { ...f, q: 'spider' };
    expect((await saleListFast(h.db, h.A, q)).total).toBe((await saleList(h.deps, h.db, h.A, q)).total);
    const of = await customerTotals(h.db, h.A);
    for (const c of await customerList(h.deps, h.db, h.A)) { const x = of(c.id); expect({ ...x, profitCents: 0 }).toEqual({ orders: c.orders, activeOrders: c.activeOrders, sales: c.sales, incomeCents: c.incomeCents, profitCents: 0, owedCents: c.owedCents, lastActivity: c.lastActivity }); expect(Math.abs(x.profitCents - c.profitCents)).toBeLessThanOrEqual(1); }
  });
});
