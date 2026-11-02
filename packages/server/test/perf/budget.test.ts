// Time budgets of docs/15 §2 on the load set of §1 (PGlite, p95). Over 2× the budget fails; over 1× is
// printed so the phase report can note it. Slow to prepare (~1–2 min): runs with `pnpm perf` (PERF=1).
import { generateLoad, LOAD } from '@app/db/load-test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../../src/dev-seed';
import { makeHarness, type Harness } from '../harness';

const RUN = process.env.PERF === '1';
let h: Harness;
const results: { name: string; p95: number; budget: number }[] = [];
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  if (!RUN) return;
  h = await makeHarness();
  await applyDevelopmentSeed(h.deps, h.A);
  await generateLoad(h.db, h.A, { today: h.deps.clock.today(), nextId: () => h.deps.ids.next() });
}, 900_000);
afterAll(async () => {
  if (!RUN) return;
  console.table(results.map((r) => ({ ...r, ratio: Math.round((r.p95 / r.budget) * 100) / 100 })));
  await h.close();
});

async function measure(name: string, budget: number, fn: () => Promise<unknown>, runs = 7) {
  const times: number[] = [];
  await fn();
  for (let i = 0; i < runs; i++) { const t = performance.now(); await fn(); times.push(performance.now() - t); }
  const p95 = Math.round(times.sort((a, b) => a - b)[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]!);
  results.push({ name, p95, budget });
  expect(p95, `${name}: p95 ${p95} ms, budget ${budget} ms`).toBeLessThanOrEqual(budget * 2);
}
const get = (p: string) => async () => { const r = await h.call('GET', `/api/v1${p}`); if (r.status !== 200) throw new Error(`${p} → ${r.status}`); return r.json as J; };
const post = async (p: string, body?: unknown) => { const r = await h.call('POST', `/api/v1${p}`, body === undefined ? {} : { body }); if (r.status >= 300) throw new Error(`${p} → ${r.status} ${JSON.stringify(r.json)}`); return (r.json as J).data as J; };

describe.runIf(RUN)(`budgets of docs/15 §2 with ${LOAD.sales} sales`, () => {
  it('lists (page of 50) ≤ 300 ms', async () => {
    for (const p of ['/sales?pageSize=50', '/orders?view=list&pageSize=50', '/orders?view=board', '/customers', '/stock', '/print-runs?pageSize=50', '/expenses', '/products', '/filaments', '/printers', '/purchases']) await measure(`GET ${p}`, 300, get(p));
  });
  it('reports: 30 days ≤ 400 ms, all ≤ 1.5 s; home ≤ 400 ms; search ≤ 200 ms', async () => {
    await measure('GET /reports?period=30', 400, get('/reports?period=30'));
    await measure('GET /reports?period=all', 1500, get('/reports?period=all'), 3);
    await measure('GET /home', 400, get('/home'));
    await measure('GET /search?q=spider', 200, get('/search?q=spider'));
  });
  it('writes ≤ 500 ms; the heaviest ≤ 800 ms', async () => {
    const products = ((await get('/products')()).data as J).items as J[];
    const channel = (((await get('/settings')()).data as J).channels as J[])[0]!.id;
    const customer = (((await get('/customers')()).data as J[])[0]!).id;
    const printer = ((((await get('/printers')()).data as J).items as J[])[0]!).id;
    const piece = products.find((p) => !p.tracksStock)!.id;
    await measure('createSale', 500, () => post('/sales', { on: '2026-11-01', channelId: channel, items: [{ kind: 'piece', productId: piece, qty: 1, priceCents: 100 }] }));
    const orderIds: string[] = [];
    await measure('createOrder (accepted)', 500, async () => { orderIds.push((await post('/orders', { customerId: customer, channelId: channel, createdOn: '2026-11-01', dueOn: '2026-11-05', accepted: true, items: [{ kind: 'piece', productId: piece, qty: 2, priceCents: 100 }] })).id); });
    let i = 0;
    await measure('startProduction', 800, async () => { const o = await get(`/orders/${orderIds[i]}`)(); await post(`/orders/${orderIds[i++]}/start-production`, { assignments: (o.data as J).items.map((it: J) => ({ lineItemId: it.id, printerId: printer })), deductFilament: true }); });
    i = 0;
    await measure('markOrderReady', 800, () => post(`/orders/${orderIds[i++]}/ready`));
    i = 0;
    const sales: string[] = [];
    await measure('deliverOrder', 800, async () => { sales.push((await post(`/orders/${orderIds[i++]}/deliver`, { on: '2026-11-02' })).saleId); });
    i = 0;
    await measure('returnSale', 800, () => post(`/sales/${sales[i++]}/return`, { on: '2026-11-02', restock: false }));
  });
});
