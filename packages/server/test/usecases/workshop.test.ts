// Settings, channels, suppliers, supplies, spools, printers and maintenance: happy path and every error of docs/12.
import { filamentDetail, printersOutput, settingsOutput, supplyDetail } from '@app/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { printerHooks } from '../../src/usecases/printers';
import { setChannelUsage } from '../../src/usecases/settings';
import { makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());
const data = <T>(r: { json: { data?: unknown } }) => r.json.data as T;

describe('settings and channels', () => {
  it('a new workspace has generic settings, one channel and the pick lists', async () => {
    const r = settingsOutput.parse(data((await h.call('GET', '/api/v1/settings'))));
    expect(r.settings).toMatchObject({ kwhPriceCents: 300, failurePct: 5, purgePct: 5, minMarginPct: 30, formulaMarginPct: 50 });
    expect(r.channels.map((c) => c.name)).toEqual(['Efectivo']);
    expect(r.catalogs.materials.length).toBeGreaterThan(5);
    expect(r.catalogs.expenseCategories.map((c) => c.name)).toContain('Mantenimiento y refacciones');
  });

  it('updateSettings changes only what is sent', async () => {
    const r = await h.call('PATCH', '/api/v1/settings', { body: { kwhPriceCents: 350, business: { name: 'Taller A', city: 'León' } } });
    expect(r.json.data).toMatchObject({ kwhPriceCents: 350, failurePct: 5, business: { name: 'Taller A', city: 'León', quoteValidDays: 7 } });
    expect((await h.call('PATCH', '/api/v1/settings', { body: { failurePct: 120 } })).status).toBe(422);
    expect((await h.call('PATCH', '/api/v1/settings', { body: { unknown: 1 } })).status).toBe(422);
  });

  it('channels: add, rename (one row), duplicate name, last channel, in use', async () => {
    const ml = data<{ id: string }>(await h.call('POST', '/api/v1/channels', { body: { name: 'Mercado Libre', commissionPct: 17 } }));
    expect((await h.call('POST', '/api/v1/channels', { body: { name: ' mercado  libre ', commissionPct: 0 } })).json).toMatchObject({ code: 'CHANNEL_NAME_EXISTS', details: { name: 'Mercado Libre' } });
    expect(data(await h.call('PATCH', `/api/v1/channels/${ml.id}`, { body: { name: 'ML', commissionPct: 15 } }))).toMatchObject({ name: 'ML', commissionPct: 15 });
    expect((await h.call('PATCH', `/api/v1/channels/${ml.id}`, { body: { name: 'efectivo' } })).json.code).toBe('CHANNEL_NAME_EXISTS');
    setChannelUsage(async () => ({ sales: 2, orders: 1 }));
    expect((await h.call('DELETE', `/api/v1/channels/${ml.id}`)).json).toMatchObject({ code: 'CHANNEL_IN_USE', details: { name: 'ML', sales: 2, orders: 1 } });
    setChannelUsage(async () => ({ sales: 0, orders: 0 }));
    expect((await h.call('DELETE', `/api/v1/channels/${ml.id}`)).status).toBe(204);
    const [only] = data<{ channels: { id: string }[] }>(await h.call('GET', '/api/v1/settings')).channels;
    expect((await h.call('DELETE', `/api/v1/channels/${only!.id}`)).json.code).toBe('LAST_CHANNEL');
  });
});

describe('suppliers and supplies', () => {
  let supplier: string;
  let supply: string;
  it('suppliers: create, update, delete and restore', async () => {
    supplier = data<{ id: string }>(await h.call('POST', '/api/v1/suppliers', { body: { name: 'Mercería', phone: '33 5555 0188' } })).id;
    expect(data(await h.call('PATCH', `/api/v1/suppliers/${supplier}`, { body: { name: 'Mercería Centro', phone: '1' } }))).toMatchObject({ name: 'Mercería Centro' });
  });

  it('createSupply with initial stock; duplicate name (ignoring case and accents)', async () => {
    const r = supplyDetail.parse(data(await h.call('POST', '/api/v1/supplies', { body: { name: 'Imán de base', unit: 'pza', costCents: 150, minimum: 10, supplierId: supplier, initialStock: 60 } })));
    supply = r.id;
    expect(r).toMatchObject({ stock: 60, status: 'ok', supplier: { name: 'Mercería Centro' } });
    expect((await h.call('POST', '/api/v1/supplies', { body: { name: 'IMAN de  base', costCents: 1 } })).json).toMatchObject({ code: 'SUPPLY_NAME_EXISTS', details: { name: 'Imán de base' } });
  });

  it('purchase adds stock and updates the unit cost from the total paid', async () => {
    const r = supplyDetail.parse(data(await h.call('POST', `/api/v1/supplies/${supply}/purchases`, { body: { qty: 40, on: '2026-11-01', costCents: 8000 } })));
    expect(r).toMatchObject({ stock: 100, costCents: 200 });
  });

  it('use, waste and count; insufficient and unchanged count', async () => {
    expect(data(await h.call('POST', `/api/v1/supplies/${supply}/movements`, { body: { kind: 'use', mode: 'delta', value: 7, on: '2026-11-01' } }))).toMatchObject({ stock: 93 });
    expect(data(await h.call('POST', `/api/v1/supplies/${supply}/movements`, { body: { kind: 'adjustment', mode: 'count', value: 90, on: '2026-11-01' } }))).toMatchObject({ stock: 90 });
    expect((await h.call('POST', `/api/v1/supplies/${supply}/movements`, { body: { kind: 'adjustment', mode: 'count', value: 90, on: '2026-11-01' } })).json.code).toBe('COUNT_UNCHANGED');
    expect((await h.call('POST', `/api/v1/supplies/${supply}/movements`, { body: { kind: 'waste', mode: 'delta', value: 91, on: '2026-11-01' } })).json).toMatchObject({ code: 'SUPPLY_INSUFFICIENT', details: { available: 90 } });
    expect(data(await h.call('POST', `/api/v1/supplies/${supply}/movements`, { body: { kind: 'adjustment', mode: 'count', value: 8, on: '2026-11-01' } }))).toMatchObject({ stock: 8, status: 'low' });
  });

  it('deleting the supplier keeps the link hidden; restoring shows it again', async () => {
    expect((await h.call('DELETE', `/api/v1/suppliers/${supplier}`)).status).toBe(204);
    expect(data(await h.call('GET', `/api/v1/supplies/${supply}`))).toMatchObject({ supplier: null });
    await h.call('POST', `/api/v1/suppliers/${supplier}/restore`);
    expect(data(await h.call('GET', `/api/v1/supplies/${supply}`))).toMatchObject({ supplier: { id: supplier } });
  });

  it('a supply used by a piece cannot be deleted; restore conflicts when the name is taken', async () => {
    const p = data<{ id: string }>(await h.call('POST', '/api/v1/products', { body: { name: 'Con imán', mode: 'value', priceCents: 100, hours: 1, supplies: [{ supplyId: supply, qty: 1 }] } }));
    expect((await h.call('DELETE', `/api/v1/supplies/${supply}`)).json).toMatchObject({ code: 'SUPPLY_IN_USE', details: { products: 1 } });
    await h.call('DELETE', `/api/v1/products/${p.id}`);
    expect((await h.call('DELETE', `/api/v1/supplies/${supply}`)).status).toBe(204);
    await h.call('POST', '/api/v1/supplies', { body: { name: 'Imán de base', costCents: 1 } });
    expect((await h.call('POST', `/api/v1/supplies/${supply}/restore`)).json).toMatchObject({ code: 'RESTORE_CONFLICT', details: { entity: 'supply' } });
  });
});

describe('spools', () => {
  let spool: string;
  let filament: string;
  it('movement: consumption, failure, waste, adjustment; never below zero', async () => {
    const r = data<{ spool: { id: string }; filament: { id: string } }>(await h.call('POST', '/api/v1/spools', { body: validSpool({ grams: 100 }) }));
    spool = r.spool.id;
    filament = r.filament.id;
    expect(data(await h.call('POST', `/api/v1/spools/${spool}/movements`, { body: { kind: 'consumption', grams: -30, on: '2026-11-01', note: 'Llaveros' } }))).toMatchObject({ spool: { remainingGrams: 70 } });
    expect(data(await h.call('POST', `/api/v1/spools/${spool}/movements`, { body: { kind: 'adjustment', grams: 5, on: '2026-11-01' } }))).toMatchObject({ spool: { remainingGrams: 75 } });
    expect((await h.call('POST', `/api/v1/spools/${spool}/movements`, { body: { kind: 'failure', grams: -80, on: '2026-11-01' } })).json).toMatchObject({ code: 'SPOOL_INSUFFICIENT', details: { availableGrams: 75 } });
    expect((await h.call('POST', `/api/v1/spools/${spool}/movements`, { body: { kind: 'waste', grams: 0, on: '2026-11-01' } })).status).toBe(422);
  });

  it('editing the grams adds an adjustment instead of rewriting the purchase', async () => {
    const r = data<{ spool: { remainingGrams: number; grams: number } }>(await h.call('PATCH', `/api/v1/spools/${spool}`, { body: { grams: 120, brand: 'eSUN' } }));
    expect(r.spool).toMatchObject({ grams: 120, remainingGrams: 95 });
    const d = filamentDetail.parse(data(await h.call('GET', `/api/v1/filaments/${filament}`)));
    expect(d.movements.map((m) => [m.kind, m.grams])).toContainEqual(['adjustment', 20]);
    expect(d.movements.find((m) => m.kind === 'purchase')?.grams).toBe(100);
  });

  it('changing material and color moves the spool to that filament', async () => {
    const r = data<{ filament: { material: string; color: string } }>(await h.call('PATCH', `/api/v1/spools/${spool}`, { body: { filament: { material: 'PETG', color: 'Verde' } } }));
    expect(r.filament).toMatchObject({ material: 'PETG', color: 'Verde', remainingGrams: 95 });
  });

  it('delete keeps its movements (they stop counting) and restore brings them back', async () => {
    expect(data(await h.call('DELETE', `/api/v1/spools/${spool}`))).toEqual({ movements: 4 });
    expect((await h.call('PATCH', `/api/v1/spools/${spool}`, { body: { brand: 'x' } })).status).toBe(404);
    expect(data(await h.call('POST', `/api/v1/spools/${spool}/restore`))).toMatchObject({ spool: { remainingGrams: 95 } });
  });
});

describe('printers and maintenance', () => {
  let printer: string;
  it('a new printer brings the 3 base tasks counting from its hours', async () => {
    const r = data<{ id: string; maintenance: { task: string; everyHours: number; lastHours: number; status: string }[] }>(await h.call('POST', '/api/v1/printers', { body: { name: 'P1S', costCents: 600000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15, hours: 240 } }));
    printer = r.id;
    expect(r.maintenance.map((t) => [t.task, t.everyHours, t.lastHours])).toEqual([['Cambiar la boquilla', 300, 240], ['Lubricar ejes', 200, 240], ['Limpiar la cama', 100, 240]]);
  });

  it('case 11.1 through the server: 240 h with the nozzle done at 0 h → Pronto; 300 h → Toca ya', async () => {
    const all = printersOutput.parse(data(await h.call('GET', '/api/v1/printers')));
    const nozzle = all.items[0]!.maintenance[0]!;
    await h.call('PATCH', `/api/v1/printers/${printer}/maintenance/${nozzle.id}`, { body: { task: 'Cambiar la boquilla', everyHours: 300, lastHours: 0 } });
    let t = printersOutput.parse(data(await h.call('GET', '/api/v1/printers'))).items[0]!.maintenance[0]!;
    expect(t).toMatchObject({ remaining: 60, status: 'soon' });
    await h.call('PATCH', `/api/v1/printers/${printer}`, { body: { name: 'P1S', costCents: 600000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15, hours: 300 } });
    t = printersOutput.parse(data(await h.call('GET', '/api/v1/printers'))).items[0]!.maintenance[0]!;
    expect(t.status).toBe('due');
  });

  it('"Hecho" resets to the current hours and records an expense when it has a cost', async () => {
    const t = printersOutput.parse(data(await h.call('GET', '/api/v1/printers'))).items[0]!.maintenance[0]!;
    const r = data<{ task: { lastHours: number; status: string; lastOn: string }; expense?: { concept: string; amountCents: number; category: string } }>(await h.call('POST', `/api/v1/printers/${printer}/maintenance/${t.id}/complete`, { body: { on: '2026-11-01', costCents: 25000 } }));
    expect(r.task).toMatchObject({ lastHours: 300, status: 'ok', lastOn: '2026-11-01' });
    expect(r.expense).toMatchObject({ concept: 'Cambiar la boquilla · P1S', amountCents: 25000, category: 'Mantenimiento y refacciones' });
    expect(data<{ expense?: unknown }>(await h.call('POST', `/api/v1/printers/${printer}/maintenance/${t.id}/complete`, { body: { on: '2026-11-01' } })).expense).toBeUndefined();
  });

  it('tasks: create, delete; printer with jobs cannot be deleted; delete and restore', async () => {
    const t = data<{ id: string }>(await h.call('POST', `/api/v1/printers/${printer}/maintenance`, { body: { task: 'Revisar correas', everyHours: 150 } }));
    expect((await h.call('DELETE', `/api/v1/printers/${printer}/maintenance/${t.id}`)).status).toBe(204);
    const original = printerHooks.queue;
    printerHooks.queue = async (_tx, _ctx, ids) => new Map(ids.map((id) => [id, [{ id, orderId: id, orderNumber: 1, text: 'x', minutes: 1, startedAt: null, remainingMinutes: 1, progress: 0 }]]));
    expect((await h.call('DELETE', `/api/v1/printers/${printer}`)).json).toMatchObject({ code: 'PRINTER_HAS_QUEUE', details: { name: 'P1S', jobs: 1 } });
    printerHooks.queue = original;
    expect((await h.call('DELETE', `/api/v1/printers/${printer}`)).status).toBe(204);
    expect(data<{ items: unknown[] }>(await h.call('GET', '/api/v1/printers')).items).toHaveLength(0);
    expect(data(await h.call('POST', `/api/v1/printers/${printer}/restore`))).toMatchObject({ id: printer, name: 'P1S' });
  });
});
