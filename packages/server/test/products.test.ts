import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { productRepo, type Database } from '@app/db';
import type { Catalogue, Product } from '@app/contract';
import { listCatalogue } from '../src/queries/catalogue';
import { addSpool } from '../src/usecases/add-spool';
import { createPrinter } from '../src/usecases/printers';
import { createSupply } from '../src/usecases/supplies';
import { deleteCollection, deleteProduct, saveCollection, saveProduct, saveProductAsVariant } from '../src/usecases/products';
import { updateSettings } from '../src/usecases/settings';
import { appFor, ctxA, ctxB, spoolInput, testDatabase, useCaseDeps } from './helpers';

let database: Database;
let ids: { filament: string; printer: string; supply: string };
beforeAll(async () => {
  database = await testDatabase();
  const deps = useCaseDeps(database);
  // Caso 2.1: kWh $3, purge 5 %, failures 5 % · filament $0.50/g · printer $6 000 / 3 000 h / $0.50 h / 0.15 kW
  await updateSettings(deps, ctxA, { kwhPriceCents: 300, purgePct: 5, failurePct: 5, minMarginPct: 30, formulaMarginPct: 50 });
  const f = await addSpool(deps, ctxA, spoolInput({ costCents: 50000, shippingCents: 0, grams: 1000 }));
  const p = await createPrinter(deps, ctxA, { name: 'Ref', costCents: 600_000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15 });
  const s = await createSupply(deps, ctxA, { name: 'Imán', costCents: 150, on: '2026-10-01' });
  ids = { filament: f.filament.id, printer: p.id, supply: s.id };
});
afterAll(() => database.close());

const piece = (o: Record<string, unknown> = {}) => ({
  name: 'Pieza 2.1',
  mode: 'formula',
  printerId: ids.printer,
  printMinutes: 120,
  extrasCents: 200,
  filaments: [{ filamentId: ids.filament, grams: 50 }],
  ...o,
});

describe('products', () => {
  let p: Product;
  it('caso 2.1 / 3.1 through the server: cost 35.9474, list price $72, floor $51.35', async () => {
    p = await saveProduct(useCaseDeps(database), ctxA, null, piece());
    expect(p.costing.total).toBeCloseTo(35.9474, 4);
    expect(p.costing.listPrice).toBe(72);
    expect(p.costing.floor).toBeCloseTo(51.35, 2);
    expect(p.printerName).toBe('Ref');
  });

  it('the server ignores any cost sent by the client', async () => {
    const r = await saveProduct(useCaseDeps(database), ctxA, p.id, { ...piece(), costing: { total: 1, listPrice: 1 } });
    expect(r.costing.total).toBeCloseTo(35.9474, 4);
  });

  it('validations: needs filament grams, price in value mode, existing references', async () => {
    const deps = useCaseDeps(database);
    await expect(saveProduct(deps, ctxA, null, piece({ filaments: [{ filamentId: ids.filament, grams: 0 }] }))).rejects.toMatchObject({ code: 'PRODUCT_NEEDS_FILAMENT' });
    await expect(saveProduct(deps, ctxA, null, piece({ mode: 'value', priceCents: 0 }))).rejects.toMatchObject({ code: 'PRODUCT_NEEDS_PRICE' });
    await expect(saveProduct(deps, ctxB, null, piece())).rejects.toMatchObject({ code: 'FILAMENT_NOT_FOUND' });
    await expect(saveProduct(deps, ctxA, null, piece({ supplies: [{ supplyId: ids.filament, qty: 1 }] }))).rejects.toMatchObject({ code: 'SUPPLY_NOT_FOUND' });
  });

  it('supplies enter E; "cualquiera" uses the average', async () => {
    const r = await saveProduct(useCaseDeps(database), ctxA, null, piece({ name: 'Con imán', mode: 'value', priceCents: 25000, printerId: null, supplies: [{ supplyId: ids.supply, qty: 2 }] }));
    expect(r.costing.E).toBeCloseTo(2 + 3, 10);
    expect(r.costing.Q).toBeCloseTo(5, 10);
    expect(r.costing.listPrice).toBe(250);
  });

  it('variant keeps the parent link', async () => {
    const v = await saveProductAsVariant(useCaseDeps(database), ctxA, p.id, piece({ name: 'Pieza 2.1 (variante)' }));
    expect(v).toMatchObject({ parentId: p.id, parentName: 'Pieza 2.1' });
  });

  it('collections: parts merged, caso 3.2 style price; deleted piece ignored and restored', async () => {
    const deps = useCaseDeps(database);
    const cat: Catalogue = await listCatalogue(database.db, ctxA);
    const magnet = cat.products.find((x) => x.name === 'Con imán')!;
    const c = await saveCollection(deps, ctxA, null, { name: 'Set', extrasCents: 500, parts: [{ productId: p.id, qty: 1 }, { productId: magnet.id, qty: 1 }, { productId: p.id, qty: 1 }] });
    expect(c.parts.map((x) => x.qty)).toEqual([2, 1]);
    expect(c.costing.loose).toBe(2 * 72 + 250);
    expect(c.costing.price).toBe(394);
    expect(c.costing.cost).toBeCloseTo(2 * p.costing.total + magnet.costing.total + 5, 6);
    await deleteProduct(deps, ctxA, magnet.id);
    expect((await listCatalogue(database.db, ctxA)).collections[0]!.costing.loose).toBe(144);
    await deleteProduct(deps, ctxA, magnet.id, true);
    expect((await listCatalogue(database.db, ctxA)).collections[0]!.costing.loose).toBe(394);
    await expect(saveCollection(deps, ctxA, null, { name: 'Vacío', parts: [] })).rejects.toMatchObject({ code: 'COLLECTION_NEEDS_PART' });
    await deleteCollection(deps, ctxA, c.id);
    expect((await listCatalogue(database.db, ctxA)).collections).toEqual([]);
  });

  it('is atomic: if replacing lines fails, the product is unchanged', async () => {
    const spy = vi.spyOn(productRepo, 'replaceLines').mockRejectedValueOnce(new Error('boom'));
    await expect(saveProduct(useCaseDeps(database), ctxA, p.id, piece({ name: 'Renamed' }))).rejects.toThrow('boom');
    spy.mockRestore();
    expect((await listCatalogue(database.db, ctxA)).products.find((x) => x.id === p.id)!.name).toBe('Pieza 2.1');
  });

  it('photo: upload an image, attach, serve it; other types and other business rejected', async () => {
    const app = appFor(database, ctxA);
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const up = await app.request('/api/v1/files', { method: 'POST', body: png, headers: { 'content-type': 'image/png' } });
    expect(up.status).toBe(201);
    const { id } = (await up.json()) as { id: string };
    const r = await app.request(`/api/v1/products/${p.id}/photo`, { method: 'PUT', body: JSON.stringify({ fileId: id }), headers: { 'content-type': 'application/json' } });
    expect(((await r.json()) as Product).photoUrl).toBe(`/api/v1/files/${id}`);
    const get = await app.request(`/api/v1/files/${id}`);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(png);
    expect((await appFor(database, ctxB).request(`/api/v1/files/${id}`)).status).toBe(404);
    const bad = await app.request('/api/v1/files', { method: 'POST', body: 'x', headers: { 'content-type': 'text/html' } });
    expect(bad.status).toBe(415);
  });

  it('HTTP: another business sees an empty catalogue', async () => {
    const r = (await (await appFor(database, ctxB).request('/api/v1/products')).json()) as Catalogue;
    expect(r).toEqual({ products: [], collections: [] });
  });
});
