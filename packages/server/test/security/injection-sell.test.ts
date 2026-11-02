// Attack strings in every text field of phase 3 are kept literally, and the phase 3 limits of docs/15 §4.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { first, seededHarness, type Seeded } from '../seeded';

let s: Seeded;
beforeAll(async () => { s = await seededHarness(); }, 120_000);
afterAll(() => s.h.close());
const ATTACK = "'; DROP TABLE sale; -- <script>x</script> =HYPERLINK(\"a\")";
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = async (m: string, p: string, body?: unknown) => (await s.h.call(m, `/api/v1${p}`, body === undefined ? {} : { body })).json as J;

describe('injection in phase 3 text fields', () => {
  it('customer, sale, order, payment, return, cancel, print run, stock note and expense keep the text', async () => {
    const c = (await call('POST', '/customers', { name: ATTACK, type: '<b>', phone: '=1+1', note: ATTACK })).data;
    expect(c).toMatchObject({ name: ATTACK, type: '<b>', phone: '=1+1', note: ATTACK });
    const item = { kind: 'piece', productId: s.a.product['Servilletero con logo'], qty: 1, priceCents: 100 };
    const sale = (await call('POST', '/sales', { on: '2026-11-01', channelId: first(s.a.channel), customerId: c.id, note: ATTACK, items: [item], paidNowCents: 10 })).data;
    expect(sale.note).toBe(ATTACK);
    expect((await call('POST', `/sales/${sale.id}/payments`, { on: '2026-11-01', amountCents: 10, note: ATTACK })).data.payments[1].note).toBe(ATTACK);
    expect((await call('POST', `/sales/${sale.id}/return`, { on: '2026-11-01', restock: false, note: ATTACK })).data.return.note).toBe(ATTACK);
    const o = (await call('POST', '/orders', { customerId: c.id, channelId: first(s.a.channel), createdOn: '2026-11-01', dueOn: '2026-11-02', accepted: false, note: ATTACK, items: [item] })).data;
    expect(o.note).toBe(ATTACK);
    expect((await call('POST', `/orders/${o.id}/cancel`, { reason: ATTACK })).data.cancellation.reason).toBe(ATTACK);
    expect((await call('POST', '/print-runs', { on: '2026-11-01', text: ATTACK, qty: 1, result: 'ok', hours: 1, reason: 'test', filaments: [] })).data.text).toBe(ATTACK);
    const st = (await call('POST', `/stock/${s.a.product['Llavero con nombre']}/adjust`, { mode: 'delta', value: 1, note: ATTACK })).data;
    expect(st.movements[0].note).toBe(ATTACK);
    expect((await call('POST', '/expenses', { on: '2026-11-01', concept: ATTACK, category: '<i>', amountCents: 1, recurring: false })).data).toMatchObject({ concept: ATTACK, category: '<i>' });
    expect((await call('GET', `/search?q=${encodeURIComponent("'; DROP")}`)).data.customers).toHaveLength(1);
  });
});

describe('phase 3 input limits (docs/15 §4)', () => {
  const sale = (items: unknown[]) => ({ on: '2026-11-01', channelId: first(s.a.channel), items });
  const item = (qty: number) => ({ kind: 'piece', productId: s.a.product['Servilletero con logo'], qty, priceCents: 1 });
  it('100 items per document pass, 101 fail; qty 100 000 passes, 100 001 fails; search needs 2 letters', async () => {
    expect((await call('POST', '/sales', sale(Array.from({ length: 100 }, () => item(1))))).data.items).toHaveLength(100);
    expect((await call('POST', '/sales', sale(Array.from({ length: 101 }, () => item(1))))).details.fields[0]).toMatchObject({ path: 'items', rule: 'too_big' });
    expect((await call('POST', '/sales', sale([item(100_000)]))).data.items[0].qty).toBe(100_000);
    expect((await call('POST', '/sales', sale([item(100_001)]))).details.fields[0]).toMatchObject({ path: 'items[0].qty', rule: 'too_big' });
    expect((await call('GET', '/search?q=a')).code).toBe('VALIDATION_ERROR');
  });
});
