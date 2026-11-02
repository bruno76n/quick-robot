// Isolation for the phase 2 tables: with A's ctx, nothing of B is read or modified, and cross-business
// references are rejected by the composite foreign keys.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectionRepo, expenseRepo, fileRepo, filamentRepo, printerRepo, productRepo, settingsRepo, supplierRepo, supplyRepo, type Ctx, type Database } from '../src';
import { ctxA, ctxB, twoWorkspaces } from './helpers';

let db: Database;
type Ids = Record<'filament' | 'supplier' | 'supply' | 'printer' | 'task' | 'product' | 'collection' | 'channel' | 'file' | 'expense', string>;
const ids: Record<'A' | 'B', Ids> = { A: {} as Ids, B: {} as Ids };

async function seed(ctx: Ctx): Promise<Ids> {
  const x = db.db;
  const f = await filamentRepo.create(x, ctx, { material: 'PLA', color: 'Negro', hex: '#000000', nameKey: 'pla|negro' });
  const sup = await supplierRepo.insert(x, ctx, { name: 'Prov', phone: '', brands: '', note: '' });
  const s = await supplyRepo.insert(x, ctx, { name: 'Argolla', nameKey: 'argolla', unit: 'pza', costCents: 50, minimum: 30, note: '', supplierId: sup.id });
  await supplyRepo.insertMovement(x, ctx, { supplyId: s.id, on: '2026-10-01', kind: 'purchase', qty: ctx === ctxA ? 200 : 50, note: '' });
  const p = await printerRepo.insert(x, ctx, { name: 'P1S', costCents: 1_200_000, lifeHours: 5000, maintenanceCentsPerHour: 60, kw: 0.12, hours: 312, purchasedOn: null });
  const t = await printerRepo.insertTask(x, ctx, { printerId: p.id, task: 'Boquilla', everyHours: 300, lastHours: 0, position: 0 });
  const pr = await productRepo.insert(
    x,
    ctx,
    { name: 'Llavero', parentId: null, mode: 'value', priceCents: 5000, marginPct: null, printerId: p.id, printMinutes: 18, batchSize: 10, extrasCents: 0, tracksStock: true, tags: [], note: '', spec: null, photoFileId: null },
    { filaments: [{ filamentId: f.id, grams: 6 }], supplies: [{ supplyId: s.id, qty: 1 }] },
  );
  const c = await collectionRepo.insert(x, ctx, { name: 'Set', priceCents: null, extrasCents: 0, tags: [], note: '' }, [{ productId: pr.id, qty: 2 }]);
  const ch = await settingsRepo.insertChannel(x, ctx, { name: 'Efectivo', nameKey: 'efectivo', commissionPct: 0, position: 0 });
  await settingsRepo.upsert(x, ctx, { kwhPriceCents: ctx === ctxA ? 300 : 400, failurePct: 5, purgePct: 5, minMarginPct: 30, formulaMarginPct: 50, business: { name: 'X', trade: '', phone: '', email: '', city: '', quoteValidDays: 7, footer: '' } });
  await settingsRepo.addCatalogItem(x, ctx, { kind: 'material', name: 'PLA', nameKey: 'pla' });
  const file = await fileRepo.insert(x, ctx, { kind: 'product_photo', mime: 'image/png', size: 1, storageKey: 'k' });
  const e = await expenseRepo.insert(x, ctx, { on: '2026-10-01', concept: 'c', category: 'Otros', amountCents: 100, recurring: false, endsOn: null });
  return { filament: f.id, supplier: sup.id, supply: s.id, printer: p.id, task: t.id, product: pr.id, collection: c.id, channel: ch.id, file: file.id, expense: e.id };
}

beforeAll(async () => {
  db = await twoWorkspaces();
  ids.A = await seed(ctxA);
  ids.B = await seed(ctxB);
});
afterAll(() => db.close());

describe('tenancy phase 2: lists only return own rows', () => {
  it.each([
    ['suppliers', () => supplierRepo.list(db.db, ctxA), 'supplier'],
    ['supplies', () => supplyRepo.list(db.db, ctxA), 'supply'],
    ['printers', () => printerRepo.list(db.db, ctxA), 'printer'],
    ['maintenance tasks', () => printerRepo.listTasks(db.db, ctxA), 'task'],
    ['products', () => productRepo.list(db.db, ctxA), 'product'],
    ['collections', () => collectionRepo.list(db.db, ctxA), 'collection'],
    ['channels', () => settingsRepo.listChannels(db.db, ctxA), 'channel'],
    ['expenses', () => expenseRepo.list(db.db, ctxA), 'expense'],
  ] as const)('%s', async (_n, list, key) => {
    expect((await list()).map((r) => r.id)).toEqual([ids.A[key]]);
  });

  it('children, sums and settings', async () => {
    const lines = await productRepo.lines(db.db, ctxA);
    expect(lines.filaments.map((l) => l.productId)).toEqual([ids.A.product]);
    expect(await productRepo.lines(db.db, ctxA, [ids.B.product])).toEqual({ filaments: [], supplies: [] });
    expect((await collectionRepo.parts(db.db, ctxA)).map((p) => p.collectionId)).toEqual([ids.A.collection]);
    expect([...(await supplyRepo.stockBySupply(db.db, ctxA)).entries()]).toEqual([[ids.A.supply, 200]]);
    expect((await settingsRepo.get(db.db, ctxA))?.kwhPriceCents).toBe(300);
    expect((await settingsRepo.listCatalog(db.db, ctxA)).length).toBe(1);
    expect(await supplyRepo.usedBy(db.db, ctxA, [ids.B.supply])).toEqual([]);
  });

  it('get by id of the other business returns nothing', async () => {
    expect(await supplierRepo.get(db.db, ctxA, ids.B.supplier)).toBeUndefined();
    expect(await supplyRepo.get(db.db, ctxA, ids.B.supply)).toBeUndefined();
    expect(await printerRepo.get(db.db, ctxA, ids.B.printer)).toBeUndefined();
    expect(await printerRepo.getTask(db.db, ctxA, ids.B.task)).toBeUndefined();
    expect(await productRepo.get(db.db, ctxA, ids.B.product, true)).toBeUndefined();
    expect(await collectionRepo.get(db.db, ctxA, ids.B.collection)).toBeUndefined();
    expect(await settingsRepo.getChannel(db.db, ctxA, ids.B.channel, true)).toBeUndefined();
    expect(await fileRepo.get(db.db, ctxA, ids.B.file)).toBeUndefined();
    expect(await expenseRepo.get(db.db, ctxA, ids.B.expense)).toBeUndefined();
  });
});

describe('tenancy phase 2: writes never touch the other business', () => {
  it('updates and soft deletes with A ctx affect 0 rows of B', async () => {
    expect(await supplierRepo.update(db.db, ctxA, ids.B.supplier, { name: 'x', phone: '', brands: '', note: '' })).toBe(0);
    expect(await supplierRepo.setDeleted(db.db, ctxA, ids.B.supplier, true)).toBe(0);
    expect(await supplyRepo.update(db.db, ctxA, ids.B.supply, { costCents: 1 })).toBe(0);
    expect(await supplyRepo.setDeleted(db.db, ctxA, ids.B.supply, true)).toBe(0);
    expect(await printerRepo.update(db.db, ctxA, ids.B.printer, { hours: 0 })).toBe(0);
    expect(await printerRepo.updateTask(db.db, ctxA, ids.B.task, { lastHours: 0 })).toBe(0);
    expect(await printerRepo.setTaskDeleted(db.db, ctxA, ids.B.task, true)).toBe(0);
    expect(await productRepo.setDeleted(db.db, ctxA, ids.B.product, true)).toBe(0);
    expect(await productRepo.setPhoto(db.db, ctxA, ids.B.product, null)).toBe(0);
    expect(await collectionRepo.setDeleted(db.db, ctxA, ids.B.collection, true)).toBe(0);
    await settingsRepo.updateChannel(db.db, ctxA, ids.B.channel, { name: 'hack' });
    expect((await settingsRepo.getChannel(db.db, ctxB, ids.B.channel))?.name).toBe('Efectivo');
    expect((await printerRepo.get(db.db, ctxB, ids.B.printer))?.hours).toBe(312);
    expect((await supplyRepo.get(db.db, ctxB, ids.B.supply))?.costCents).toBe(50);
  });

  it('cross-business references are rejected by the database', async () => {
    const x = db.db;
    await expect(supplyRepo.insertMovement(x, ctxA, { supplyId: ids.B.supply, on: '2026-10-02', kind: 'use', qty: -1, note: '' })).rejects.toThrow();
    await expect(supplyRepo.insert(x, ctxA, { name: 'Z', nameKey: 'z', unit: 'pza', costCents: 1, minimum: 0, note: '', supplierId: ids.B.supplier })).rejects.toThrow();
    await expect(printerRepo.insertTask(x, ctxA, { printerId: ids.B.printer, task: 't', everyHours: 1, lastHours: 0, position: 0 })).rejects.toThrow();
    const base = { name: 'Bad', parentId: null, mode: 'value' as const, priceCents: 1, marginPct: null, printerId: null, printMinutes: 0, batchSize: 1, extrasCents: 0, tracksStock: false, tags: [], note: '', spec: null, photoFileId: null };
    await expect(db.transaction((tx) => productRepo.insert(tx, ctxA, base, { filaments: [{ filamentId: ids.B.filament, grams: 1 }], supplies: [] }))).rejects.toThrow();
    await expect(db.transaction((tx) => productRepo.insert(tx, ctxA, base, { filaments: [], supplies: [{ supplyId: ids.B.supply, qty: 1 }] }))).rejects.toThrow();
    await expect(db.transaction((tx) => collectionRepo.insert(tx, ctxA, { name: 'S', priceCents: null, extrasCents: 0, tags: [], note: '' }, [{ productId: ids.B.product, qty: 1 }]))).rejects.toThrow();
    expect((await productRepo.list(x, ctxA)).map((p) => p.name)).toEqual(['Llavero']);
  });
});
