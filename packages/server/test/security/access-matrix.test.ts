// Access matrix (docs/12 §11, docs/11 A01): every registered route, called by A with ids of B → 404,
// nothing of B leaks or changes; no session → 401; unknown role → 403. A new route with an id that is not
// in SAMPLES makes this test fail until it is added.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { B_TOKEN } from '../harness';
import { first, seededHarness, type Seeded } from '../seeded';

let s: Seeded;
beforeAll(async () => { s = await seededHarness(); }, 120_000);
afterAll(() => s.h.close());

const spool = { filament: { material: 'PLA', color: 'Negro' }, brand: '', costCents: 100, shippingCents: 0, grams: 10, purchasedOn: '2026-11-01' };
const supply = { name: 'X', unit: 'pza', costCents: 1, minimum: 1, note: '' };
const printer = { name: 'X', costCents: 1, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 };
const product = () => ({ name: 'X', mode: 'value', priceCents: 100, hours: 1, filaments: [], supplies: [] });

/** How to call each route with ids of workspace B. */
const SAMPLES: Record<string, { path: () => string; body?: () => unknown }> = {
  'GET /api/v1/filaments/:id': { path: () => `/api/v1/filaments/${first(s.b.filament)}` },
  'PATCH /api/v1/spools/:id': { path: () => `/api/v1/spools/${s.b.spool}`, body: () => ({ brand: 'x' }) },
  'DELETE /api/v1/spools/:id': { path: () => `/api/v1/spools/${s.b.spool}` },
  'POST /api/v1/spools/:id/restore': { path: () => `/api/v1/spools/${s.b.spool}/restore` },
  'POST /api/v1/spools/:id/movements': { path: () => `/api/v1/spools/${s.b.spool}/movements`, body: () => ({ kind: 'consumption', grams: -1, on: '2026-11-01' }) },
  'PATCH /api/v1/channels/:id': { path: () => `/api/v1/channels/${first(s.b.channel)}`, body: () => ({ name: 'x' }) },
  'DELETE /api/v1/channels/:id': { path: () => `/api/v1/channels/${first(s.b.channel)}` },
  'GET /api/v1/supplies/:id': { path: () => `/api/v1/supplies/${first(s.b.supply)}` },
  'PATCH /api/v1/supplies/:id': { path: () => `/api/v1/supplies/${first(s.b.supply)}`, body: () => supply },
  'DELETE /api/v1/supplies/:id': { path: () => `/api/v1/supplies/${first(s.b.supply)}` },
  'POST /api/v1/supplies/:id/restore': { path: () => `/api/v1/supplies/${first(s.b.supply)}/restore` },
  'POST /api/v1/supplies/:id/purchases': { path: () => `/api/v1/supplies/${first(s.b.supply)}/purchases`, body: () => ({ qty: 1, on: '2026-11-01' }) },
  'POST /api/v1/supplies/:id/movements': { path: () => `/api/v1/supplies/${first(s.b.supply)}/movements`, body: () => ({ kind: 'use', mode: 'delta', value: 1, on: '2026-11-01' }) },
  'PATCH /api/v1/suppliers/:id': { path: () => `/api/v1/suppliers/${first(s.b.supplier)}`, body: () => ({ name: 'x' }) },
  'DELETE /api/v1/suppliers/:id': { path: () => `/api/v1/suppliers/${first(s.b.supplier)}` },
  'POST /api/v1/suppliers/:id/restore': { path: () => `/api/v1/suppliers/${first(s.b.supplier)}/restore` },
  'PATCH /api/v1/printers/:id': { path: () => `/api/v1/printers/${first(s.b.printer)}`, body: () => printer },
  'DELETE /api/v1/printers/:id': { path: () => `/api/v1/printers/${first(s.b.printer)}` },
  'POST /api/v1/printers/:id/restore': { path: () => `/api/v1/printers/${first(s.b.printer)}/restore` },
  'POST /api/v1/printers/:id/maintenance': { path: () => `/api/v1/printers/${first(s.b.printer)}/maintenance`, body: () => ({ task: 'x', everyHours: 10 }) },
  'PATCH /api/v1/printers/:id/maintenance/:taskId': { path: () => `/api/v1/printers/${first(s.b.printer)}/maintenance/${s.b.task}`, body: () => ({ task: 'x', everyHours: 10 }) },
  'DELETE /api/v1/printers/:id/maintenance/:taskId': { path: () => `/api/v1/printers/${first(s.b.printer)}/maintenance/${s.b.task}` },
  'POST /api/v1/printers/:id/maintenance/:taskId/complete': { path: () => `/api/v1/printers/${first(s.b.printer)}/maintenance/${s.b.task}/complete`, body: () => ({ on: '2026-11-01' }) },
  'GET /api/v1/products/:id': { path: () => `/api/v1/products/${first(s.b.product)}` },
  'PUT /api/v1/products/:id': { path: () => `/api/v1/products/${first(s.b.product)}`, body: product },
  'POST /api/v1/products/:id/variant': { path: () => `/api/v1/products/${first(s.b.product)}/variant`, body: product },
  'DELETE /api/v1/products/:id': { path: () => `/api/v1/products/${first(s.b.product)}` },
  'POST /api/v1/products/:id/restore': { path: () => `/api/v1/products/${first(s.b.product)}/restore` },
  'GET /api/v1/collections/:id': { path: () => `/api/v1/collections/${first(s.b.collection)}` },
  'PUT /api/v1/collections/:id': { path: () => `/api/v1/collections/${first(s.b.collection)}`, body: () => ({ name: 'x', parts: [{ productId: first(s.a.product), qty: 1 }] }) },
  'DELETE /api/v1/collections/:id': { path: () => `/api/v1/collections/${first(s.b.collection)}` },
  'POST /api/v1/collections/:id/restore': { path: () => `/api/v1/collections/${first(s.b.collection)}/restore` },
  'GET /api/v1/files/:id': { path: () => `/api/v1/files/${s.b.file}` },
};

/** Writes of A that point to entities of B through the body must also fail (404) and leave B intact. */
const BODY_REFS: { method: string; path: () => string; body: () => unknown }[] = [
  { method: 'POST', path: () => '/api/v1/spools', body: () => ({ ...spool, filament: undefined, filamentId: first(s.b.filament) }) },
  { method: 'POST', path: () => '/api/v1/supplies', body: () => ({ ...supply, supplierId: first(s.b.supplier) }) },
  { method: 'POST', path: () => '/api/v1/products', body: () => ({ ...product(), printerId: first(s.b.printer) }) },
  { method: 'POST', path: () => '/api/v1/products', body: () => ({ ...product(), filaments: [{ filamentId: first(s.b.filament), grams: 1 }] }) },
  { method: 'POST', path: () => '/api/v1/products', body: () => ({ ...product(), supplies: [{ supplyId: first(s.b.supply), qty: 1 }] }) },
  { method: 'POST', path: () => '/api/v1/products', body: () => ({ ...product(), photoFileId: s.b.file }) },
  { method: 'POST', path: () => '/api/v1/collections', body: () => ({ name: 'x', parts: [{ productId: first(s.b.product), qty: 1 }] }) },
];

const snapshotB = async () => {
  const paths = ['/api/v1/filaments?pageSize=200', '/api/v1/supplies', '/api/v1/suppliers', '/api/v1/printers', '/api/v1/products', '/api/v1/collections', '/api/v1/settings',
    `/api/v1/filaments/${first(s.b.filament)}`, `/api/v1/supplies/${first(s.b.supply)}`, `/api/v1/products/${first(s.b.product)}`];
  return JSON.stringify(await Promise.all(paths.map(async (p) => (await s.h.call('GET', p, { token: B_TOKEN })).json.data)));
};
const allB = () => [...Object.values(s.b).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)))];

describe('access matrix', () => {
  it('every route with an id has a sample', () => {
    const withId = s.h.app.routes.filter((r) => r.path.includes(':')).map((r) => `${r.method} ${r.path}`);
    expect(withId.filter((k) => !SAMPLES[k])).toEqual([]);
  });

  it('A calling routes with ids of B gets 404, without B ids in the answer, and B is unchanged', async () => {
    const before = await snapshotB();
    for (const r of s.h.app.routes.filter((x) => x.path.includes(':'))) {
      const sample = SAMPLES[`${r.method} ${r.path}`]!;
      const res = await s.h.call(r.method, sample.path(), sample.body ? { body: sample.body() } : {});
      expect(res.status, `${r.method} ${r.path}`).toBe(404);
      const text = JSON.stringify(res.json);
      for (const id of allB()) expect(text).not.toContain(id);
    }
    for (const w of BODY_REFS) expect((await s.h.call(w.method, w.path(), { body: w.body() })).status, w.path()).toBe(404);
    expect(await snapshotB()).toBe(before);
  });

  it('lists of A never contain anything of B', async () => {
    for (const r of s.h.app.routes.filter((x) => x.method === 'GET' && !x.path.includes(':'))) {
      const text = JSON.stringify((await s.h.call('GET', r.path)).json);
      for (const id of allB()) expect(text, r.path).not.toContain(id);
    }
  });

  it('no session → 401 on every route', async () => {
    for (const r of s.h.app.routes) {
      const path = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-7000-8000-000000000000');
      const res = await s.h.call(r.method, path, { token: null, ...(r.method === 'GET' || r.method === 'DELETE' ? {} : { body: {} }) });
      expect(res.status, `${r.method} ${r.path}`).toBe(401);
    }
  });

  it('an unknown role → 403 on every route (deny by default)', async () => {
    for (const r of s.h.app.routes) {
      const path = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-7000-8000-000000000000');
      const res = await s.h.call(r.method, path, { token: 'token-nobody', ...(r.method === 'GET' || r.method === 'DELETE' ? {} : { body: {} }) });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });

  it('invalid ids (not UUID, injection, relative paths) → 404 before the database', async () => {
    for (const bad of ['abc', "1'%20or%20'1'='1", '..%2F..%2Fetc%2Fpasswd']) {
      for (const base of ['filaments', 'products', 'supplies', 'collections', 'files']) expect((await s.h.call('GET', `/api/v1/${base}/${bad}`)).status).toBe(404);
    }
  });
});
