// Time budgets of docs/15 §2 on the load set of §1 (PGlite, p95). Over 2× the budget fails; over 1× is
// printed so the phase report can note it. Slow to prepare (~1–2 min): runs with `pnpm perf` (PERF=1).
import { connectPglite, DEFAULT_MIGRATIONS } from '@app/db';
import { generateLoad, LOAD } from '@app/db/load-test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../../src/dev-seed';
import { makeHarness, type Harness } from '../harness';

const RUN = process.env.PERF === '1';
let h: Harness;
const results: { name: string; p95: number; budget: number }[] = [];
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  if (!RUN) return;
  // The load set takes minutes to build: it is kept as a dump next to the test database, per migrations + generator.
  const key = createHash('sha256').update(readFileSync(new URL('../../../db/seed/load-test.ts', import.meta.url))).update(readdirSync(DEFAULT_MIGRATIONS).join()).digest('hex').slice(0, 12);
  const file = join(tmpdir(), 'app-test-db', `perf-${key}.tar`);
  if (existsSync(file)) {
    h = await makeHarness({}, await connectPglite({ loadDataDir: new Blob([readFileSync(file)]), migrate: false }));
  } else {
    h = await makeHarness();
    await applyDevelopmentSeed(h.deps, h.A);
    await generateLoad(h.db, h.A, { today: h.deps.clock.today(), nextId: () => h.deps.ids.next() });
    mkdirSync(join(tmpdir(), 'app-test-db'), { recursive: true });
    writeFileSync(file, Buffer.from(await (await h.conn.dump!()).arrayBuffer()));
  }
}, 900_000);
afterAll(async () => {
  if (!RUN) return;
  // eslint-disable-next-line no-console -- the phase report copies this table
  console.table(results.map((r) => ({ ...r, ratio: Math.round((r.p95 / r.budget) * 100) / 100 })));
  await h.close();
});

async function measure(name: string, budget: number, fn: () => Promise<unknown>, runs = 7) {
  if (process.env.PERF_ONLY && !new RegExp(process.env.PERF_ONLY).test(name)) return;
  const times: number[] = [];
  await fn();
  for (let i = 0; i < runs; i++) { const t = performance.now(); await fn(); times.push(performance.now() - t); }
  const p95 = Math.round(times.sort((a, b) => a - b)[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]!);
  results.push({ name, p95, budget });
  expect.soft(p95, `${name}: p95 ${p95} ms, budget ${budget} ms`).toBeLessThanOrEqual(budget * 2);
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
  it('importing a copy with 25 000 sales ≤ 30 s (docs/15 §2)', async () => {
    const { exportData, importWorkspace } = await import('../../src/usecases/workspace-data');
    const bytes = new TextEncoder().encode(JSON.stringify(await exportData(h.deps, h.A)));
    await measure('import 25 000 sales', 30_000, () => importWorkspace(h.deps, h.B, bytes, { confirm: true, backupFirst: false }), 1);
  }, 600_000);

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

/** docs/15 §3: the 6 heavy queries use their indexes; a full scan of a big table fails. */
describe.runIf(RUN)('EXPLAIN of the heavy queries', () => {
  const BIG = /Seq Scan on (sale|line_item|payment|stock_movement|spool_movement|supply_movement|print_run|"order")\b/;
  const plan = async (q: ReturnType<typeof sql>) => {
    await h.db.execute(sql`set enable_seqscan = on`);
    const r = await h.db.execute(sql`explain ${q}`);
    return ((r as unknown as { rows: Record<string, string>[] }).rows ?? []).map((x) => Object.values(x)[0]).join('\n');
  };
  it('sales page, sale items, customer page, stock of a piece, 30-day report, active orders', async () => {
    const ws = h.A.workspaceId;
    const one = ((await h.db.execute(sql`select id, customer_id from sale where workspace_id = ${ws} and customer_id is not null limit 1`)) as unknown as { rows: { id: string; customer_id: string }[] }).rows[0]!;
    const prod = ((await h.db.execute(sql`select id from product where workspace_id = ${ws} and tracks_stock limit 1`)) as unknown as { rows: { id: string }[] }).rows[0]!.id;
    const queries: [string, ReturnType<typeof sql>][] = [
      ['sales page', sql`select * from sale where workspace_id = ${ws} and deleted_at is null order by "on" desc, created_at desc, id desc limit 50`],
      ['items of a page', sql`select parent_id, sum(qty * price_cents) from line_item where workspace_id = ${ws} and parent_kind = 'sale' and parent_id in (${one.id}) group by parent_id`],
      ['customer page', sql`select * from sale where workspace_id = ${ws} and deleted_at is null and customer_id = ${one.customer_id}`],
      ['stock of a piece', sql`select coalesce(sum(qty), 0) from stock_movement where workspace_id = ${ws} and product_id = ${prod}`],
      ['30-day report', sql`select * from sale where workspace_id = ${ws} and deleted_at is null and "on" >= '2026-10-03' and "on" <= '2026-11-01'`],
      ['home: active orders', sql`select * from "order" where workspace_id = ${ws} and deleted_at is null and status in ('quoted', 'accepted', 'in_production', 'ready')`],
    ];
    for (const [name, q] of queries) { const p = await plan(q); console.log( // eslint-disable-line no-console
      `-- ${name}\n${p}`); expect.soft(p, name).not.toMatch(BIG); }
  });
});
