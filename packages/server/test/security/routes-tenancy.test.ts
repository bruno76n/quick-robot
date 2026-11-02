// docs/11 · A01: every registered route, called by business A with ids of business B, answers 404 and
// changes nothing of B. A new route with an id makes this test fail until it is added here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@app/db';
import { listCatalogue } from '../../src/queries/catalogue';
import { listFilaments, getFilamentDetail } from '../../src/queries/filaments';
import { listPrinters } from '../../src/queries/printers';
import { listSupplies } from '../../src/queries/supplies';
import { getSettingsBundle } from '../../src/queries/settings';
import { uploadImage } from '../../src/usecases/files';
import { localDeps } from '../../src/local-deps';
import { appAs, ctxA, ctxB, PNG, snapshot, twoBusinesses } from './fixtures';

let database: Database;
const B: Record<string, string> = {};
let bodies: Record<string, unknown>;

beforeAll(async () => {
  database = await twoBusinesses();
  const x = database.db;
  const [cat, fil, sup, pri, set] = await Promise.all([listCatalogue(x, ctxB), listFilaments(x, ctxB), listSupplies(x, ctxB), listPrinters(x, ctxB), getSettingsBundle(x, ctxB)]);
  const detail = await getFilamentDetail(x, ctxB, fil.items[0]!.id);
  B.filament = fil.items[0]!.id;
  B.spool = detail.spools[0]!.id;
  B.channel = set.channels[0]!.id;
  B.supply = sup.items[0]!.id;
  B.supplier = sup.suppliers[0]!.id;
  B.printer = pri.items[0]!.id;
  B.task = pri.items[0]!.tasks[0]!.id;
  B.product = cat.products[0]!.id;
  B.collection = cat.collections[0]!.id;
  B.file = (await uploadImage(localDeps({ database, workspaceId: ctxB.workspaceId, userId: ctxB.userId, filesDir: '/tmp/app-sec-files' }), ctxB, { mime: 'image/png', bytes: PNG })).id;
  // Valid bodies that reference A's own data, so the only possible failure is "B's id not found".
  const a = await listCatalogue(x, ctxA);
  const aFil = (await listFilaments(x, ctxA)).items[0]!.id;
  const p = a.products[0]!;
  const product = { name: 'x', mode: 'value', priceCents: 100, printMinutes: 10, filaments: [{ filamentId: aFil, grams: 5 }] };
  const spool = { material: 'PLA', color: 'Negro', costCents: 100, grams: 10, purchasedOn: '2026-11-01' };
  bodies = {
    'PUT /api/v1/filaments/spools/:id': spool,
    'POST /api/v1/filaments/spools/:id/movements': { kind: 'consumption', grams: 1, on: '2026-11-01' },
    'PATCH /api/v1/settings/channels/:id': { name: 'Hack' },
    'PUT /api/v1/suppliers/:id': { name: 'Hack' },
    'PUT /api/v1/supplies/:id': { name: 'Hack', costCents: 1 },
    'POST /api/v1/supplies/:id/purchases': { qty: 1, on: '2026-11-01' },
    'POST /api/v1/supplies/:id/movements': { kind: 'use', qty: 1, on: '2026-11-01' },
    'PUT /api/v1/printers/:id': { name: 'Hack', costCents: 1 },
    'POST /api/v1/printers/:id/tasks': { task: 'Hack', everyHours: 10 },
    'PUT /api/v1/printers/tasks/:taskId': { task: 'Hack', everyHours: 10 },
    'POST /api/v1/printers/tasks/:taskId/complete': { on: '2026-11-01', costCents: 100 },
    'PUT /api/v1/products/:id': product,
    'POST /api/v1/products/:id/variants': product,
    'PUT /api/v1/products/:id/photo': { fileId: null },
    'PUT /api/v1/collections/:id': { name: 'Hack', parts: [{ productId: p.id, qty: 1 }] },
  };
});
afterAll(() => database.close());

/** Which id of B each route parameter takes. */
function idFor(path: string, param: string): string {
  if (param === 'taskId') return B.task!;
  if (path.includes('/filaments/spools/')) return B.spool!;
  if (path.startsWith('/api/v1/filaments/')) return B.filament!;
  if (path.includes('/settings/channels/')) return B.channel!;
  const resource = path.split('/')[3]!;
  const map: Record<string, string | undefined> = { suppliers: B.supplier, supplies: B.supply, printers: B.printer, products: B.product, collections: B.collection, files: B.file };
  const id = map[resource];
  if (!id) throw new Error(`No id of B for ${path} — add it to routes-tenancy.test.ts`);
  return id;
}

describe('A01 · every route with an id of another business → 404, nothing changes', () => {
  it('covers all registered routes', async () => {
    const { app } = appAs(database, ctxA);
    const routes = app.routes.filter((r) => r.path.startsWith('/api/v1/') && r.path.includes('/:') && r.method !== 'ALL');
    const seen = new Set<string>();
    expect(routes.length).toBeGreaterThan(30);
    const before = await snapshot(database, ctxB);
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = r.path.replace(/:(\w+)/g, (_m, name: string) => idFor(r.path, name));
      const body = bodies[key];
      if (['PUT', 'PATCH'].includes(r.method) || (r.method === 'POST' && !r.path.endsWith('/restore'))) expect(body, `sample body for ${key}`).toBeDefined();
      const res = await app.request(url, body === undefined ? { method: r.method } : { method: r.method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
      expect(res.status, key).toBe(404);
      const text = await res.text();
      for (const id of Object.values(B)) expect(text, `${key} leaked an id of B`).not.toContain(id);
    }
    expect(await snapshot(database, ctxB)).toBe(before);
  });

  it('lists of A never contain anything of B', async () => {
    const { app } = appAs(database, ctxA);
    const lists = app.routes.filter((r) => r.method === 'GET' && r.path.startsWith('/api/v1/') && !r.path.includes('/:'));
    for (const r of lists) {
      const text = await (await app.request(r.path)).text();
      for (const id of Object.values(B)) expect(text, `${r.path} leaked an id of B`).not.toContain(id);
    }
  });
});
