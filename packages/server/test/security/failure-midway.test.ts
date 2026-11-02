// A failure halfway through any write use case leaves nothing written (docs/11 A10, docs/12 §11).
// WRITE_ROUTES must list every write route; a new one without a case makes the test fail. Each case is
// run with a failure injected at write #1, #2, … until it succeeds; every failed run must leave A unchanged.
import { schema, type Ctx } from '@app/db';
import { eq, getTableColumns, getTableName, isTable } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Deps } from '../../src/deps';
import { addSpool } from '../../src/usecases/add-spool';
import { completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, restorePrinter, updateMaintenanceTask, updatePrinter } from '../../src/usecases/printers';
import { deleteCollection, deleteProduct, restoreCollection, restoreProduct, saveCollection, saveProduct, saveProductAsVariant } from '../../src/usecases/products';
import { addChannel, removeChannel, updateChannel, updateSettings } from '../../src/usecases/settings';
import { deleteSpool, recordSpoolMovement, restoreSpool, updateSpool } from '../../src/usecases/spools';
import { createSupplier, deleteSupplier, restoreSupplier, updateSupplier } from '../../src/usecases/suppliers';
import { createSupply, deleteSupply, recordSupplyMovement, recordSupplyPurchase, restoreSupply, updateSupply } from '../../src/usecases/supplies';
import { uploadFile } from '../../src/usecases/files';
import { failOnWrite, validSpool } from '../harness';
import { first, seededHarness, type Seeded } from '../seeded';

let s: Seeded;
beforeAll(async () => { s = await seededHarness(); }, 120_000);
afterAll(() => s.h.close());

type Run = (d: Deps, c: Ctx, target: string) => Promise<unknown>;
interface Case { setup?: (c: Ctx) => Promise<string>; run: Run }
const product = (name: string) => ({ name, tags: [], mode: 'value' as const, priceCents: 100, hours: 1, batchSize: 1, extrasCents: 0, tracksStock: false, filaments: [{ filamentId: first(s.a.filament), grams: 10 }], supplies: [{ supplyId: first(s.a.supply), qty: 1 }], note: '' });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const d0 = () => s.h.deps;
let k = 0;
const uniq = (p: string) => `${p} ${++k}`;

// Fresh targets made with the normal deps, so cases do not depend on each other.
const newSpool = async (c: Ctx) => (await addSpool(d0(), c, validSpool({ filament: { material: 'PLA', color: uniq('Tono') } }))).spool.id;
const newSupply = async (c: Ctx) => (await createSupply(d0(), c, { name: uniq('Insumo'), unit: 'pza', costCents: 100, minimum: 1, note: '', initialStock: 10 })).id;
const newSupplier = async (c: Ctx) => (await createSupplier(d0(), c, { name: uniq('Proveedor'), phone: '', brands: '', note: '' })).id;
const newPrinter = async (c: Ctx) => (await createPrinter(d0(), c, { name: uniq('Impresora'), costCents: 100, lifeHours: 10, maintenanceCentsPerHour: 0, kw: 0 })).id;
const newTask = async (c: Ctx) => { const p = await newPrinter(c); const t = await createMaintenanceTask(d0(), c, p, { task: 'T', everyHours: 10 }); return `${p}|${t.id}`; };
const newProduct = async (c: Ctx) => (await saveProduct(d0(), c, product(uniq('Pieza')))).id;
const newCollection = async (c: Ctx) => (await saveCollection(d0(), c, { name: uniq('Set'), tags: [], parts: [{ productId: first(s.a.product), qty: 1 }], extrasCents: 0, note: '' })).id;
const newChannel = async (c: Ctx) => (await addChannel(d0(), c, { name: uniq('Canal'), commissionPct: 0 })).id;
const deleted = (make: (c: Ctx) => Promise<string>, del: (d: Deps, c: Ctx, id: string) => Promise<unknown>) => async (c: Ctx) => { const id = await make(c); await del(d0(), c, id); return id; };
const split = (t: string) => t.split('|') as [string, string];

const WRITE_ROUTES: Record<string, Case> = {
  'POST /api/v1/spools': { run: (d, c) => addSpool(d, c, validSpool({ filament: { material: 'ASA', color: uniq('Midway') }, brand: uniq('Marca') })) },
  'PATCH /api/v1/spools/:id': { setup: newSpool, run: (d, c, t) => updateSpool(d, c, t, { grams: 1500, filament: { material: 'PLA', color: uniq('Otro tono') } }) },
  'DELETE /api/v1/spools/:id': { setup: newSpool, run: (d, c, t) => deleteSpool(d, c, t) },
  'POST /api/v1/spools/:id/restore': { setup: deleted(newSpool, deleteSpool), run: (d, c, t) => restoreSpool(d, c, t) },
  'POST /api/v1/spools/:id/movements': { setup: newSpool, run: (d, c, t) => recordSpoolMovement(d, c, t, { kind: 'consumption', grams: -1, on: '2026-11-01' }) },
  'PATCH /api/v1/settings': { run: (d, c) => updateSettings(d, c, { kwhPriceCents: 999, business: { name: 'Otro' } }) },
  'POST /api/v1/channels': { run: (d, c) => addChannel(d, c, { name: uniq('Canal'), commissionPct: 1 }) },
  'PATCH /api/v1/channels/:id': { setup: newChannel, run: (d, c, t) => updateChannel(d, c, t, { name: uniq('Renombrado') }) },
  'DELETE /api/v1/channels/:id': { setup: newChannel, run: (d, c, t) => removeChannel(d, c, t) },
  'POST /api/v1/supplies': { run: (d, c) => createSupply(d, c, { name: uniq('Midway'), unit: 'pza', costCents: 1, minimum: 1, note: '', initialStock: 5 }) },
  'PATCH /api/v1/supplies/:id': { setup: newSupply, run: (d, c, t) => updateSupply(d, c, t, { name: uniq('Cambiado'), unit: 'pza', costCents: 1, minimum: 1, note: '' }) },
  'DELETE /api/v1/supplies/:id': { setup: newSupply, run: (d, c, t) => deleteSupply(d, c, t) },
  'POST /api/v1/supplies/:id/restore': { setup: deleted(newSupply, deleteSupply), run: (d, c, t) => restoreSupply(d, c, t) },
  'POST /api/v1/supplies/:id/purchases': { setup: newSupply, run: (d, c, t) => recordSupplyPurchase(d, c, t, { qty: 10, on: '2026-11-01', costCents: 1000 }) },
  'POST /api/v1/supplies/:id/movements': { setup: newSupply, run: (d, c, t) => recordSupplyMovement(d, c, t, { kind: 'adjustment', mode: 'count', value: 1, on: '2026-11-01' }) },
  'POST /api/v1/suppliers': { run: (d, c) => createSupplier(d, c, { name: 'Midway', phone: '', brands: '', note: '' }) },
  'PATCH /api/v1/suppliers/:id': { setup: newSupplier, run: (d, c, t) => updateSupplier(d, c, t, { name: 'Cambiado', phone: '', brands: '', note: '' }) },
  'DELETE /api/v1/suppliers/:id': { setup: newSupplier, run: (d, c, t) => deleteSupplier(d, c, t) },
  'POST /api/v1/suppliers/:id/restore': { setup: deleted(newSupplier, deleteSupplier), run: (d, c, t) => restoreSupplier(d, c, t) },
  'POST /api/v1/printers': { run: (d, c) => createPrinter(d, c, { name: 'Midway', costCents: 1, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }) },
  'PATCH /api/v1/printers/:id': { setup: newPrinter, run: (d, c, t) => updatePrinter(d, c, t, { name: 'Cambiada', costCents: 1, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }) },
  'DELETE /api/v1/printers/:id': { setup: newPrinter, run: (d, c, t) => deletePrinter(d, c, t) },
  'POST /api/v1/printers/:id/restore': { setup: deleted(newPrinter, deletePrinter), run: (d, c, t) => restorePrinter(d, c, t) },
  'POST /api/v1/printers/:id/maintenance': { setup: newPrinter, run: (d, c, t) => createMaintenanceTask(d, c, t, { task: 'Midway', everyHours: 10 }) },
  'PATCH /api/v1/printers/:id/maintenance/:taskId': { setup: newTask, run: (d, c, t) => updateMaintenanceTask(d, c, ...split(t), { task: 'Cambiada', everyHours: 10 }) },
  'DELETE /api/v1/printers/:id/maintenance/:taskId': { setup: newTask, run: (d, c, t) => deleteMaintenanceTask(d, c, ...split(t)) },
  'POST /api/v1/printers/:id/maintenance/:taskId/complete': { setup: newTask, run: (d, c, t) => completeMaintenance(d, c, ...split(t), { on: '2026-11-01', costCents: 5000 }) },
  'POST /api/v1/products': { run: (d, c) => saveProduct(d, c, product('Midway')) },
  'PUT /api/v1/products/:id': { setup: newProduct, run: (d, c, t) => saveProduct(d, c, product('Cambiada'), t) },
  'POST /api/v1/products/:id/variant': { setup: newProduct, run: (d, c, t) => saveProductAsVariant(d, c, t, product('Variante')) },
  'DELETE /api/v1/products/:id': { setup: newProduct, run: (d, c, t) => deleteProduct(d, c, t) },
  'POST /api/v1/products/:id/restore': { setup: deleted(newProduct, deleteProduct), run: (d, c, t) => restoreProduct(d, c, t) },
  'POST /api/v1/collections': { run: (d, c) => saveCollection(d, c, { name: 'Midway', tags: [], parts: [{ productId: first(s.a.product), qty: 2 }], extrasCents: 0, note: '' }) },
  'PUT /api/v1/collections/:id': { setup: newCollection, run: (d, c, t) => saveCollection(d, c, { name: 'Cambiada', tags: [], parts: [{ productId: first(s.a.product), qty: 1 }], extrasCents: 0, note: '' }, t) },
  'DELETE /api/v1/collections/:id': { setup: newCollection, run: (d, c, t) => deleteCollection(d, c, t) },
  'POST /api/v1/collections/:id/restore': { setup: deleted(newCollection, deleteCollection), run: (d, c, t) => restoreCollection(d, c, t) },
  'POST /api/v1/files': { run: (d, c) => uploadFile(d, c, 'product_photo', PNG) },
};

/** Every row of workspace A in every table (the whole state of the business). */
async function snapshot(ctx: Ctx) {
  const out: Record<string, unknown[]> = {};
  for (const t of Object.values(schema).filter((x) => isTable(x)) as PgTable[]) {
    const cols = getTableColumns(t) as Record<string, Parameters<typeof eq>[0]>;
    const ws = cols.workspaceId ?? (getTableName(t) === 'workspace' ? cols.id : undefined);
    if (!ws) continue;
    const rows = await s.h.db.select().from(t).where(eq(ws, ctx.workspaceId));
    out[getTableName(t)] = rows.map((r) => JSON.stringify(r)).sort();
  }
  return JSON.stringify(out);
}

describe('failure midway', () => {
  it('every write route has a case', () => {
    const writes = s.h.app.routes.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`);
    expect(writes.filter((w) => !WRITE_ROUTES[w])).toEqual([]);
  });

  it.each(Object.keys(WRITE_ROUTES))('%s: any injected failure → nothing written', async (name) => {
    const kase = WRITE_ROUTES[name]!;
    const target = kase.setup ? await kase.setup(s.h.A) : '';
    let failures = 0;
    for (let n = 1; n <= 40; n++) {
      const before = await snapshot(s.h.A);
      let failed = false;
      try { await kase.run({ ...s.h.deps, db: failOnWrite(s.h.db, n) }, s.h.A, target); } catch (e) {
        if (!/injected/.test(String((e as Error).message))) throw e;
        failed = true;
      }
      if (!failed) break;
      failures += 1;
      expect(await snapshot(s.h.A), `${name} write #${n}`).toBe(before);
    }
    expect(failures, `${name} wrote nothing`).toBeGreaterThan(0);
  });

  it('an unexpected error over HTTP → 500 with a generic message and errorId, never the trace', async () => {
    const { createApp } = await import('../../src/app');
    const res = await createApp({ ...s.h.deps, db: failOnWrite(s.h.db, 1) }).request('http://127.0.0.1/api/v1/spools', {
      method: 'POST', headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' }, body: JSON.stringify(validSpool()),
    });
    expect(res.status).toBe(500);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Unexpected error' });
    expect(JSON.stringify(json)).not.toMatch(/injected|at |\.ts/);
  });
});
