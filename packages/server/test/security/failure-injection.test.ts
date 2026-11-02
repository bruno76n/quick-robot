// docs/11 · A10: for every write use case, its main write runs and then the operation fails — the
// transaction must roll back completely (nothing written, nothing half-done).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { collectionRepo, expenseRepo, filamentRepo, printerRepo, productRepo, settingsRepo, supplierRepo, supplyRepo, type Database } from '@app/db';
import { listCatalogue } from '../../src/queries/catalogue';
import { getFilamentDetail, listFilaments } from '../../src/queries/filaments';
import { listPrinters } from '../../src/queries/printers';
import { getCatalog, getSettingsBundle } from '../../src/queries/settings';
import { listSupplies } from '../../src/queries/supplies';
import { addSpool } from '../../src/usecases/add-spool';
import { completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, updateMaintenanceTask, updatePrinter } from '../../src/usecases/printers';
import { deleteCollection, deleteProduct, saveCollection, saveProduct, saveProductAsVariant } from '../../src/usecases/products';
import { addChannel, removeChannel, updateChannel, updateSettings } from '../../src/usecases/settings';
import { deleteSpool, recordSpoolMovement, updateSpool } from '../../src/usecases/spools';
import { createSupplier, createSupply, deleteSupplier, deleteSupply, recordSupplyMovement, recordSupplyPurchase, updateSupplier, updateSupply } from '../../src/usecases/supplies';
import { useCaseDeps } from '../helpers';
import { ctxA, snapshot, twoBusinesses } from './fixtures';

let database: Database;
let ids: Record<string, string>;
beforeAll(async () => {
  database = await twoBusinesses();
  const x = database.db;
  const [cat, fil, sup, pri, set] = await Promise.all([listCatalogue(x, ctxA), listFilaments(x, ctxA), listSupplies(x, ctxA), listPrinters(x, ctxA), getSettingsBundle(x, ctxA)]);
  const detail = await getFilamentDetail(x, ctxA, fil.items.find((f) => f.spoolCount === 1)!.id);
  const unusedSupply = sup.items.find((s) => s.usedBy.length === 0)!;
  ids = {
    filament: fil.items[0]!.id,
    spool: detail.spools[0]!.id,
    channel: set.channels[0]!.id,
    supply: unusedSupply.id,
    supplier: sup.suppliers[0]!.id,
    printer: pri.items[0]!.id,
    task: pri.items[0]!.tasks[0]!.id,
    product: cat.products[0]!.id,
    collection: cat.collections[0]!.id,
  };
});
afterAll(() => database.close());
afterEach(() => vi.restoreAllMocks());

/** Run the real method, then throw: the write happened inside the transaction and must be rolled back. */
function failAfter<T extends object>(obj: T, method: keyof T) {
  const original = (obj[method] as (...a: unknown[]) => Promise<unknown>).bind(obj);
  vi.spyOn(obj, method as never).mockImplementation((async (...args: unknown[]) => {
    await original(...args);
    throw new Error('injected failure');
  }) as never);
}

const everything = async () => JSON.stringify([await snapshot(database, ctxA), await expenseRepo.list(database.db, ctxA), await getCatalog(database.db, ctxA)]);
const deps = () => useCaseDeps(database);
const product = () => ({ name: 'Nueva', mode: 'value', priceCents: 9900, printMinutes: 30, filaments: [{ filamentId: ids.filament!, grams: 12 }] });
const spool = (o: object = {}) => ({ material: 'PLA', color: 'Inventado', hex: '#123456', brand: 'Marca nueva', costCents: 30000, grams: 1000, purchasedOn: '2026-11-01', ...o });

const CASES: [name: string, obj: object, method: string, run: () => Promise<unknown>][] = [
  ['addSpool', filamentRepo, 'insertMovement', () => addSpool(deps(), ctxA, spool())],
  ['updateSpool', filamentRepo, 'insertMovement', () => updateSpool(deps(), ctxA, ids.spool!, spool({ grams: 1234 }))],
  ['deleteSpool', filamentRepo, 'setSpoolDeleted', () => deleteSpool(deps(), ctxA, ids.spool!)],
  ['recordSpoolMovement', filamentRepo, 'insertMovement', () => recordSpoolMovement(deps(), ctxA, ids.spool!, { kind: 'waste', grams: 5, on: '2026-11-01' })],
  ['updateSettings', settingsRepo, 'upsert', () => updateSettings(deps(), ctxA, { purgePct: 9 })],
  ['addChannel', settingsRepo, 'insertChannel', () => addChannel(deps(), ctxA, { name: 'Tienda' })],
  ['updateChannel', settingsRepo, 'updateChannel', () => updateChannel(deps(), ctxA, ids.channel!, { commissionPct: 9 })],
  ['removeChannel', settingsRepo, 'updateChannel', () => removeChannel(deps(), ctxA, ids.channel!)],
  ['createSupplier', supplierRepo, 'insert', () => createSupplier(deps(), ctxA, { name: 'Nuevo' })],
  ['updateSupplier', supplierRepo, 'update', () => updateSupplier(deps(), ctxA, ids.supplier!, { name: 'Otro' })],
  ['deleteSupplier', supplierRepo, 'setDeleted', () => deleteSupplier(deps(), ctxA, ids.supplier!)],
  ['createSupply', supplyRepo, 'insertMovement', () => createSupply(deps(), ctxA, { name: 'Nuevo insumo', costCents: 10, initialQty: 5, on: '2026-11-01' })],
  ['updateSupply', supplyRepo, 'update', () => updateSupply(deps(), ctxA, ids.supply!, { name: 'Renombrado', costCents: 99 })],
  ['deleteSupply', supplyRepo, 'setDeleted', () => deleteSupply(deps(), ctxA, ids.supply!)],
  ['recordSupplyPurchase', supplyRepo, 'update', () => recordSupplyPurchase(deps(), ctxA, ids.supply!, { qty: 10, totalCents: 777, on: '2026-11-01' })],
  ['recordSupplyMovement', supplyRepo, 'insertMovement', () => recordSupplyMovement(deps(), ctxA, ids.supply!, { kind: 'use', qty: 1, on: '2026-11-01' })],
  ['createPrinter', printerRepo, 'insertTask', () => createPrinter(deps(), ctxA, { name: 'Nueva', costCents: 100 })],
  ['updatePrinter', printerRepo, 'update', () => updatePrinter(deps(), ctxA, ids.printer!, { name: 'Renombrada', costCents: 1 })],
  ['deletePrinter', printerRepo, 'setDeleted', () => deletePrinter(deps(), ctxA, ids.printer!)],
  ['createMaintenanceTask', printerRepo, 'insertTask', () => createMaintenanceTask(deps(), ctxA, ids.printer!, { task: 'Nueva', everyHours: 50 })],
  ['updateMaintenanceTask', printerRepo, 'updateTask', () => updateMaintenanceTask(deps(), ctxA, ids.task!, { task: 'Otra', everyHours: 51 })],
  ['deleteMaintenanceTask', printerRepo, 'setTaskDeleted', () => deleteMaintenanceTask(deps(), ctxA, ids.task!)],
  ['completeMaintenance', expenseRepo, 'insert', () => completeMaintenance(deps(), ctxA, ids.task!, { on: '2026-11-01', costCents: 5000 })],
  ['saveProduct (new)', productRepo, 'replaceLines', () => saveProduct(deps(), ctxA, null, product())],
  ['saveProduct (edit)', productRepo, 'replaceLines', () => saveProduct(deps(), ctxA, ids.product!, product())],
  ['saveProductAsVariant', productRepo, 'replaceLines', () => saveProductAsVariant(deps(), ctxA, ids.product!, product())],
  ['deleteProduct', productRepo, 'setDeleted', () => deleteProduct(deps(), ctxA, ids.product!)],
  ['saveCollection (new)', collectionRepo, 'replaceParts', () => saveCollection(deps(), ctxA, null, { name: 'Set', parts: [{ productId: ids.product!, qty: 2 }] })],
  ['saveCollection (edit)', collectionRepo, 'replaceParts', () => saveCollection(deps(), ctxA, ids.collection!, { name: 'Set', parts: [{ productId: ids.product!, qty: 2 }] })],
  ['deleteCollection', collectionRepo, 'setDeleted', () => deleteCollection(deps(), ctxA, ids.collection!)],
];

describe('A10 · a failure in the middle leaves nothing written', () => {
  it.each(CASES)('%s', async (_name, obj, method, run) => {
    const before = await everything();
    failAfter(obj, method as never);
    await expect(run()).rejects.toThrow('injected failure');
    vi.restoreAllMocks();
    expect(await everything()).toBe(before);
  });

  it('the same operations succeed without the failure (the table is not testing no-ops)', async () => {
    const before = await everything();
    await addSpool(deps(), ctxA, spool());
    expect(await everything()).not.toBe(before);
  });
});
