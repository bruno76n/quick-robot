// Workspace A never sees nor modifies anything of workspace B (docs/05 › Aislamiento, docs/14 §4).
import { getTableColumns, getTableName, isTable } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Connection } from '../src/connect';
import * as schema from '../src/schema';
import {
  findFilamentByKey, getFilament, getSpool, insertFilament, insertSpool, insertSpoolMovements, listFilaments,
  listSpoolMovements, listSpools, lockSpoolsOfFilament,
} from '../src/repos/filament-repo';
import { getRole, getWorkspace } from '../src/repos/workspace-repo';
import { deleteTask, getPrinter, getTask, insertTasks, listPrinters, listTasks, updatePrinter, updateTask } from '../src/repos/printer-repo';
import { getCollection, getProduct, insertProduct, listCollections, listProducts, replaceCollectionParts, replaceProductParts, setProductDeleted, updateCollection } from '../src/repos/product-repo';
import { deleteChannel, getChannel, getFile, getSettings, listCatalog, listChannels, updateChannel } from '../src/repos/settings-repo';
import { findSupplyByKey, getSuppliesByIds, getSupplier, getSupply, insertSupply, insertSupplyMovements, listSuppliers, listSupplies, listSupplyMovements, productsUsingSupply, setSupplierDeleted, updateSupply } from '../src/repos/supply-repo';
import { countLiveVariants, listProductFamilies } from '../src/repos/product-family-repo';
import { openTestDb } from '../src/testing';
import { twoWorkspaces, uid, type WsData } from './fixtures';

/** Tables covered by this file. A new table with workspace_id must be added here (and tested). */
const COVERED = new Set(['membership', 'filament', 'spool', 'spool_movement', 'workspace_settings', 'sales_channel', 'catalog_item', 'file', 'supplier', 'supply', 'supply_movement', 'printer', 'maintenance_task', 'expense', 'product', 'product_filament', 'product_supply', 'collection', 'collection_part', 'stock_movement', 'customer', 'order', 'sale', 'line_item', 'payment', 'print_run', 'print_run_filament', 'print_queue_entry']);
const WITHOUT_WORKSPACE = new Set(['workspace', 'user']);

let conn: Connection;
let A: WsData;
let B: WsData;
beforeAll(async () => {
  conn = await openTestDb();
  ({ A, B } = await twoWorkspaces(conn.db));
});
afterAll(() => conn.close());

describe('schema', () => {
  const tables = Object.values(schema).filter((t) => isTable(t)) as Parameters<typeof getTableName>[0][];
  it.each(tables.map((t) => [getTableName(t), t] as const))('%s has workspace_id and is covered', (name, t) => {
    if (WITHOUT_WORKSPACE.has(name)) return;
    expect(Object.values(getTableColumns(t)).map((c) => c.name)).toContain('workspace_id');
    expect(COVERED.has(name)).toBe(true);
  });
});

describe('reads with ctx A never return B', () => {
  it('workspace and role', async () => {
    expect((await getWorkspace(conn.db, A.ctx))?.name).toBe('Negocio A');
    expect(await getRole(conn.db, { workspaceId: A.ctx.workspaceId, userId: B.ctx.userId })).toBeUndefined();
  });
  it('lists only its own filaments, also when searching', async () => {
    for (const q of [undefined, 'PLA', 'Negro', 'PLA Negro']) {
      const r = await listFilaments(conn.db, A.ctx, { q, page: 1, pageSize: 50 });
      expect(r.items.map((f) => f.id)).toEqual([A.filamentId]);
      expect(r.total).toBe(1);
    }
  });
  it('lookups by id or key of B find nothing', async () => {
    expect(await getFilament(conn.db, A.ctx, B.filamentId)).toBeUndefined();
    expect((await findFilamentByKey(conn.db, A.ctx, 'pla|negro'))?.id).toBe(A.filamentId);
    expect(await getSpool(conn.db, A.ctx, B.spoolId)).toBeUndefined();
    expect(await listSpools(conn.db, A.ctx, [B.filamentId])).toEqual([]);
    expect(await listSpoolMovements(conn.db, A.ctx, B.filamentId)).toEqual([]);
  });
  it('sums (spool_levels) only count its own ledger', async () => {
    const [s] = await listSpools(conn.db, A.ctx, [A.filamentId, B.filamentId]);
    expect(s?.remainingGrams).toBe(1000);
  });
});

describe('workshop and catalog: reads with ctx A never return B', () => {
  it('settings, channels, catalog and files', async () => {
    expect((await getSettings(conn.db, A.ctx))?.business.name).toBe('Negocio A');
    expect((await listChannels(conn.db, A.ctx)).map((c) => c.id)).toEqual([A.channelId]);
    expect(await getChannel(conn.db, A.ctx, B.channelId)).toBeUndefined();
    expect((await listCatalog(conn.db, A.ctx)).every((c) => c.workspaceId === A.ctx.workspaceId)).toBe(true);
    expect(await getFile(conn.db, A.ctx, B.fileId)).toBeUndefined();
  });
  it('suppliers, supplies and their ledger', async () => {
    expect((await listSuppliers(conn.db, A.ctx)).map((x) => x.id)).toEqual([A.supplierId]);
    expect(await getSupplier(conn.db, A.ctx, B.supplierId)).toBeUndefined();
    const l = await listSupplies(conn.db, A.ctx, { page: 1, pageSize: 50 });
    expect(l.items.map((x) => [x.id, x.stock])).toEqual([[A.supplyId, 100]]);
    expect(await getSupply(conn.db, A.ctx, B.supplyId)).toBeUndefined();
    expect(await getSuppliesByIds(conn.db, A.ctx, [B.supplyId])).toEqual([]);
    expect(await listSupplyMovements(conn.db, A.ctx, B.supplyId)).toEqual([]);
    expect(await productsUsingSupply(conn.db, A.ctx, B.supplyId)).toEqual([]);
    expect(await findSupplyByKey(conn.db, A.ctx, 'argolla')).toMatchObject({ id: A.supplyId });
  });
  it('printers, tasks, products and collections', async () => {
    expect((await listPrinters(conn.db, A.ctx)).map((x) => x.id)).toEqual([A.printerId]);
    expect(await getPrinter(conn.db, A.ctx, B.printerId)).toBeUndefined();
    expect((await listTasks(conn.db, A.ctx)).map((x) => x.id)).toEqual([A.taskId]);
    expect(await getTask(conn.db, A.ctx, B.printerId, B.taskId)).toBeUndefined();
    expect((await listProducts(conn.db, A.ctx)).map((x) => x.id)).toEqual([A.productId]);
    expect(await getProduct(conn.db, A.ctx, B.productId)).toBeUndefined();
    expect((await listCollections(conn.db, A.ctx)).map((x) => [x.id, x.parts.length])).toEqual([[A.collectionId, 1]]);
    expect(await getCollection(conn.db, A.ctx, B.collectionId)).toBeUndefined();
  });
  it('updates and deletes with ids of B change nothing', async () => {
    expect(await updateSupply(conn.db, A.ctx, B.supplyId, { name: 'x' })).toBeUndefined();
    expect(await setSupplierDeleted(conn.db, A.ctx, B.supplierId, new Date())).toBeUndefined();
    expect(await updatePrinter(conn.db, A.ctx, B.printerId, { name: 'x' })).toBeUndefined();
    expect(await updateTask(conn.db, A.ctx, B.taskId, { task: 'x' })).toBeUndefined();
    expect(await setProductDeleted(conn.db, A.ctx, B.productId, new Date())).toBeUndefined();
    expect(await updateCollection(conn.db, A.ctx, B.collectionId, { name: 'x' })).toBeUndefined();
    expect(await updateChannel(conn.db, A.ctx, B.channelId, { name: 'x' })).toBeUndefined();
    await deleteChannel(conn.db, A.ctx, B.channelId);
    await deleteTask(conn.db, A.ctx, B.taskId);
    await replaceProductParts(conn.db, A.ctx, B.productId, [], []);
    expect((await getProduct(conn.db, B.ctx, B.productId))?.filaments).toHaveLength(1);
    expect(await getChannel(conn.db, B.ctx, B.channelId)).toBeDefined();
    expect((await getSupply(conn.db, B.ctx, B.supplyId))?.name).toBe('Argolla');
  });
  it('composite keys reject children that point to B', async () => {
    await expect(insertSupply(conn.db, A.ctx, { id: uid(0xa), name: 'z', nameKey: 'z', costCents: 1, minimum: 1, supplierId: B.supplierId })).rejects.toThrow();
    await expect(insertProduct(conn.db, A.ctx, { id: uid(0xa), name: 'z', mode: 'value', hours: 1, printerId: B.printerId })).rejects.toThrow();
    await expect(replaceProductParts(conn.db, A.ctx, A.productId, [{ id: uid(0xa), filamentId: B.filamentId, grams: 1 }], [])).rejects.toThrow();
    await expect(replaceCollectionParts(conn.db, A.ctx, A.collectionId, [{ id: uid(0xa), productId: B.productId, qty: 1 }])).rejects.toThrow();
    await expect(insertTasks(conn.db, A.ctx, [{ id: uid(0xa), printerId: B.printerId, task: 'z', everyHours: 1 }])).rejects.toThrow();
    await expect(insertSupplyMovements(conn.db, A.ctx, [{ id: uid(0xa), supplyId: B.supplyId, on: '2026-11-01', kind: 'use', qty: -1 }])).rejects.toThrow();
  });
});

describe('writes with ctx A never touch B', () => {
  it('cannot attach a spool to a filament of B (composite foreign key)', async () => {
    await expect(insertSpool(conn.db, A.ctx, { id: uid(0xa), filamentId: B.filamentId, brand: '', costCents: 1, shippingCents: 0, grams: 1, purchasedOn: '2026-11-01' })).rejects.toThrow();
  });
  it('cannot add a movement to a spool of B', async () => {
    await expect(insertSpoolMovements(conn.db, A.ctx, [{ id: uid(0xa), spoolId: B.spoolId, on: '2026-11-01', kind: 'consumption', grams: -10, note: '' }])).rejects.toThrow();
    expect((await listSpools(conn.db, B.ctx, [B.filamentId]))[0]?.remainingGrams).toBe(1000);
  });
  it('the same filament name is allowed in both workspaces', async () => {
    expect((await findFilamentByKey(conn.db, B.ctx, 'pla|negro'))?.id).toBe(B.filamentId);
  });
  it('locking A spools does not lock B', async () => {
    await conn.db.transaction(async (tx) => {
      await lockSpoolsOfFilament(tx, A.ctx, B.filamentId);
      await lockSpoolsOfFilament(tx, A.ctx, A.filamentId);
    });
  });
});

describe('a repository without ctx fails before SQL', () => {
  it.each([
    ['listFilaments', () => listFilaments(conn.db, undefined as never, { page: 1, pageSize: 1 })],
    ['getFilament', () => getFilament(conn.db, { workspaceId: '', userId: '' }, A.filamentId)],
    ['insertFilament', () => insertFilament(conn.db, { workspaceId: 'x', userId: 'x' }, { id: uid(1), material: 'a', color: 'b', hex: '#000000', nameKey: 'a|b' })],
    ['insertSpoolMovements', () => insertSpoolMovements(conn.db, null as never, [])],
  ])('%s', async (_n, fn) => {
    await expect(fn()).rejects.toThrow(/ctx/);
  });
});

describe('product families (docs/12 §5): ctx A never sees B, two queries of pieces per page', () => {
  const TECH = ['PETG', 'ABS'];
  let variantA: string;
  beforeAll(async () => {
    variantA = (await insertProduct(conn.db, A.ctx, { id: uid(0xa), name: 'Llavero (variante)', parentId: A.productId, variantLabel: 'Azul', mode: 'value', hours: 1 })).id;
    // Only the variant has filament: a family is technical when any member is.
    await replaceProductParts(conn.db, A.ctx, variantA, [{ id: uid(0xa), filamentId: A.filamentId, grams: 5 }], []);
    await insertProduct(conn.db, B.ctx, { id: uid(0xb), name: 'Llavero azul', parentId: B.productId, variantLabel: 'Azul', mode: 'value', hours: 1 });
    await insertProduct(conn.db, B.ctx, { id: uid(0xb), name: 'Solo de B', mode: 'value', hours: 1 });
  });

  it('a page has only its own originals and variants, also when searching or filtering', async () => {
    for (const q of [undefined, 'llavero', 'azul']) for (const filter of ['all', 'with_variants'] as const) {
      const r = await listProductFamilies(conn.db, A.ctx, { q, filter, page: 1, pageSize: 50, technicalPrefixes: TECH });
      expect(r.roots.map((x) => x.id)).toEqual([A.productId]);
      expect(r.variants.map((x) => x.id)).toEqual([variantA]);
      expect(r.counts).toEqual({ families: 1, technical: 0, withVariants: 1 });
    }
    const tech = await listProductFamilies(conn.db, A.ctx, { filter: 'technical', page: 1, pageSize: 50, technicalPrefixes: ['pla'] });
    expect([tech.total, tech.roots.map((x) => x.id)]).toEqual([1, [A.productId]]);
    expect((await listProductFamilies(conn.db, A.ctx, { q: 'Solo de B', page: 1, pageSize: 50, technicalPrefixes: TECH })).total).toBe(0);
    expect(await countLiveVariants(conn.db, A.ctx, B.productId)).toBe(0);
    expect(await countLiveVariants(conn.db, A.ctx, A.productId)).toBe(1);
  });

  it('the number of queries does not grow with the page (no query per card)', async () => {
    const tables: string[] = [];
    const spy = new Proxy(conn.db, {
      get(target, key) {
        const v = Reflect.get(target, key) as unknown;
        if (key !== 'select') return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        return (...args: unknown[]) => {
          const b = (v as (...a: unknown[]) => { from: (t: Parameters<typeof getTableName>[0]) => unknown }).apply(target, args);
          const from = b.from.bind(b);
          b.from = (t) => { tables.push(getTableName(t)); return from(t); };
          return b;
        };
      },
    });
    for (let i = 0; i < 6; i++) await insertProduct(conn.db, A.ctx, { id: uid(0xa), name: `Pieza ${i}`, mode: 'value', hours: 1 });
    const runs: string[][] = [];
    for (const pageSize of [1, 7]) {
      tables.length = 0;
      const r = await listProductFamilies(spy as typeof conn.db, A.ctx, { page: 1, pageSize, technicalPrefixes: TECH });
      expect(r.roots).toHaveLength(pageSize);
      runs.push([...tables]);
    }
    // counts, originals, variants (parent_id IN …), then their filaments and supplies.
    expect(runs[0]).toEqual(['product', 'product', 'product', 'product_filament', 'product_supply']);
    expect(runs[1]).toEqual(runs[0]);
  });
});
