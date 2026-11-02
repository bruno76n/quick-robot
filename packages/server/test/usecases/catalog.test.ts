// Pieces, collections and files: golden values through the server, the server ignores client costs,
// and every error of docs/12 §5 and §10.
import { collectionDetail, productDetail, uploadOutput } from '@app/contract';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { productHooks } from '../../src/usecases/products';
import { makeHarness, type Harness } from '../harness';
import { first, seededHarness, type Seeded } from '../seeded';

const golden = JSON.parse(readFileSync(new URL('../../../core/test/golden/mockup-values.json', import.meta.url), 'utf8'));
const close = (a: number, e: number) => expect(Math.abs(a - e)).toBeLessThanOrEqual(0.01);
let s: Seeded;
beforeAll(async () => { s = await seededHarness(); }, 120_000);
afterAll(() => s.h.close());
const data = <T>(r: { json: { data?: unknown } }) => r.json.data as T;

describe('golden values through the server', () => {
  it('every piece: cost, list price and floor (in cents, ±$0.01)', async () => {
    const items = data<{ items: { name: string; costCents: number; listCents: number; floorCents: number }[] }>(await s.h.call('GET', '/api/v1/products')).items;
    expect(items).toHaveLength(golden.productos.length);
    for (const g of golden.productos as { nombre: string; costo: number; precio: number; piso: number }[]) {
      const p = items.find((x) => x.name === g.nombre)!;
      close(p.costCents / 100, Math.round(g.costo * 100) / 100);
      close(p.listCents / 100, g.precio);
      close(p.floorCents / 100, Math.round(g.piso * 100) / 100);
    }
  });

  it('breakdown of a piece and suggested price per channel', async () => {
    const g = golden.productos.find((x: { id: string }) => x.id === 'pr8');
    const d = productDetail.parse(data(await s.h.call('GET', `/api/v1/products/${s.a.product[g.nombre]}`)));
    close(d.breakdown.materialCents / 100, Math.round(g.M * 100) / 100);
    close(d.breakdown.machineCents / 100, Math.round(g.Q * 100) / 100);
    close(d.breakdown.failureReserveCents / 100, Math.round(g.F * 100) / 100);
    expect(d.listCents).toBe(7900);
    const ml = d.profitByChannel.find((c) => c.name === 'Mercado Libre')!;
    close(ml.suggestedCents / 100, Math.round((g.costo / (1 - 0.5 - 0.17)) * 100) / 100);
  });

  it('every collection: cost, price, loose sum and floor', async () => {
    for (const g of golden.colecciones as { nombre: string; costo: number; precio: number; sueltas: number; piso: number }[]) {
      const d = collectionDetail.parse(data(await s.h.call('GET', `/api/v1/collections/${s.a.collection[g.nombre]}`)));
      close(d.costCents / 100, Math.round(g.costo * 100) / 100);
      close(d.listCents / 100, g.precio);
      close(d.looseCents / 100, g.sueltas);
      close(d.floorCents / 100, Math.round(g.piso * 100) / 100);
    }
  });

  it('filters: technical pieces and variants', async () => {
    const tech = data<{ items: { name: string }[] }>(await s.h.call('GET', '/api/v1/products?filter=technical')).items.map((p) => p.name);
    expect(tech).toEqual(['Soporte de celular PETG']);
    const variants = data<{ items: { name: string; parentId: string }[] }>(await s.h.call('GET', '/api/v1/products?filter=variant')).items;
    expect(variants.map((p) => [p.name, p.parentId])).toEqual([['Spider-Man · salto (silk morado)', s.a.product['Spider-Man · salto']]]);
  });
});

describe('saveProduct and friends', () => {
  it('case 2.1 and 3.1 through the server; costs sent by the client are ignored', async () => {
    const h: Harness = await makeHarness();
    try {
      const printer = data<{ id: string }>(await h.call('POST', '/api/v1/printers', { body: { name: 'P', costCents: 600000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15 } }));
      const sp = data<{ filament: { id: string } }>(await h.call('POST', '/api/v1/spools', { body: { filament: { material: 'PLA', color: 'Negro' }, costCents: 50000, shippingCents: 0, grams: 1000, purchasedOn: '2026-11-01', brand: '' } }));
      const r = await h.call('POST', '/api/v1/products', { body: { name: 'Caso 2.1', mode: 'formula', hours: 2, extrasCents: 200, printerId: printer.id, filaments: [{ filamentId: sp.filament.id, grams: 50 }], costCents: 1, listCents: 1, breakdown: { costCents: 1 } } });
      expect(r.status).toBe(201);
      const d = productDetail.parse(r.json.data);
      expect(d.breakdown).toEqual({ materialCents: 2625, powerCents: 90, machineCents: 500, extrasCents: 200, failureReserveCents: 180, costCents: 3595 });
      expect(d.listCents).toBe(7200);
      expect(d.floorCents).toBe(5135);
    } finally { await h.close(); }
  });

  it('value mode needs a price; references of another workspace or missing → 404', async () => {
    expect((await s.h.call('POST', '/api/v1/products', { body: { name: 'Sin precio', mode: 'value', hours: 1 } })).json).toMatchObject({ code: 'VALIDATION_ERROR', details: { fields: [{ path: 'price', rule: 'required' }] } });
    expect((await s.h.call('POST', '/api/v1/products', { body: { name: 'X', mode: 'value', priceCents: 1, hours: 1, printerId: first(s.b.printer) } })).status).toBe(404);
  });

  it('variant: a copy with parentId; delete and restore', async () => {
    const base = first(s.a.product);
    const d = productDetail.parse(data(await s.h.call('GET', `/api/v1/products/${base}`)));
    const v = productDetail.parse(data(await s.h.call('POST', `/api/v1/products/${base}/variant`, { body: { ...d, name: `${d.name} (variante)`, priceCents: d.priceCents } })));
    expect(v.parentId).toBe(base);
    expect((await s.h.call('DELETE', `/api/v1/products/${v.id}`)).status).toBe(204);
    expect((await s.h.call('GET', `/api/v1/products/${v.id}`)).status).toBe(404);
    expect(data(await s.h.call('POST', `/api/v1/products/${v.id}/restore`))).toMatchObject({ id: v.id });
  });

  it('deleting a piece in active orders or with stock is refused; turning off stock with pieces on hand too', async () => {
    const id = first(s.a.product);
    const orig = { ...productHooks };
    productHooks.activeOrderFolios = async () => [3, 6];
    expect((await s.h.call('DELETE', `/api/v1/products/${id}`)).json).toMatchObject({ code: 'PRODUCT_IN_ACTIVE_ORDERS', details: { count: 2, folios: ['#3', '#6'] } });
    productHooks.activeOrderFolios = async () => [];
    productHooks.stock = async (_t, _c, ids) => new Map(ids.map((x) => [x, { physical: 4, reserved: 0, free: 4 }]));
    expect((await s.h.call('DELETE', `/api/v1/products/${id}`)).json).toMatchObject({ code: 'PRODUCT_HAS_STOCK', details: { onHand: 4 } });
    const d = productDetail.parse(data(await s.h.call('GET', `/api/v1/products/${id}`)));
    expect((await s.h.call('PUT', `/api/v1/products/${id}`, { body: { ...d, tracksStock: false } })).json).toMatchObject({ code: 'STOCK_TRACKING_HAS_STOCK', details: { onHand: 4 } });
    productHooks.stock = orig.stock;
    productHooks.activeOrderFolios = orig.activeOrderFolios;
  });

  it('collections: empty, no products, save with typed price and restore', async () => {
    expect((await s.h.call('POST', '/api/v1/collections', { body: { name: 'Vacía', parts: [] } })).json.code).toBe('COLLECTION_EMPTY');
    const h = await makeHarness();
    try { expect((await h.call('POST', '/api/v1/collections', { body: { name: 'X', parts: [] } })).json.code).toBe('NO_PRODUCTS'); } finally { await h.close(); }
    const c = collectionDetail.parse(data(await s.h.call('POST', '/api/v1/collections', { body: { name: 'Dúo', parts: [{ productId: s.a.product['Spider-Man · salto'], qty: 2 }], priceCents: 45000 } })));
    expect(c).toMatchObject({ listCents: 45000, looseCents: 50000, pieces: 2 });
    await s.h.call('DELETE', `/api/v1/collections/${c.id}`);
    expect(data(await s.h.call('POST', `/api/v1/collections/${c.id}/restore`))).toMatchObject({ id: c.id });
  });
});

describe('files', () => {
  const upload = (bytes: Uint8Array, kind = 'product_photo', type = 'image/png') => {
    const fd = new FormData();
    fd.set('kind', kind);
    fd.set('file', new Blob([bytes as unknown as ArrayBuffer], { type }), 'x');
    return s.h.app.request('http://127.0.0.1/api/v1/files', { method: 'POST', headers: { authorization: 'Bearer token-a' }, body: fd });
  };
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);

  it('a real PNG is stored and served isolated with nosniff', async () => {
    const res = await upload(PNG);
    expect(res.status).toBe(201);
    const { fileId, url } = uploadOutput.parse(((await res.json()) as { data: unknown }).data);
    const got = await s.h.app.request(`http://127.0.0.1${url}`, { headers: { authorization: 'Bearer token-a' } });
    expect(got.headers.get('content-type')).toBe('image/png');
    expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect(got.headers.get('content-security-policy')).toContain('sandbox');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(PNG);
    expect((await s.h.call('GET', `/api/v1/files/${fileId}`, { token: 'token-b' })).status).toBe(404);
  });

  it('HTML disguised as PNG, or other types → UNSUPPORTED_IMAGE; too big → FILE_TOO_LARGE', async () => {
    const html = await upload(new TextEncoder().encode('<html><script>alert(1)</script>'), 'product_photo', 'image/png');
    expect(await html.json()).toMatchObject({ code: 'UNSUPPORTED_IMAGE' });
    const big = new Uint8Array(8 * 1024 * 1024 + 10);
    big.set(PNG);
    const r = await upload(big, 'customer_logo');
    expect(r.status).toBe(413);
    expect(await r.json()).toMatchObject({ code: 'FILE_TOO_LARGE', details: { maxMb: 8 } });
  });
});
