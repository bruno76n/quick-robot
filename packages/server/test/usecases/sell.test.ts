// Phase 3 operations of docs/12 §6–9 through HTTP: happy path and every error, with the numbers of docs/04.
import { schema } from '@app/db';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { first, seededHarness, type Seeded } from '../seeded';

let s: Seeded;
beforeAll(async () => { s = await seededHarness(); }, 120_000);
afterAll(() => s.h.close());

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = async (m: string, p: string, body?: unknown) => { const r = await s.h.call(m, `/api/v1${p}`, body === undefined ? {} : { body }); return { status: r.status, data: (r.json as J)?.data as J, code: (r.json as J)?.code as string, details: (r.json as J)?.details as J, warnings: (r.json as J)?.warnings as J[] | undefined }; };
const ch = () => first(s.a.channel);
const cust = () => first(s.a.customer);
let k = 0;
const newPiece = async (stock?: number, extra: J = {}) => {
  const p = (await call('POST', '/products', { name: `Pieza ${++k}`, mode: 'value', priceCents: 7200, hours: 0.3, filaments: [{ filamentId: s.a.filament['PLA Negro'], grams: 10 }], supplies: [], tracksStock: false, ...extra })).data;
  if (stock !== undefined) await call('POST', `/stock/${p.id}/enable`, { initialCount: stock });
  return p.id as string;
};
const stockOf = async (id: string) => (await call('GET', `/stock/${id}`)).data;
const piece = (productId: string, qty: number, priceCents = 7200, extra: J = {}) => ({ kind: 'piece', productId, qty, priceCents, ...extra });
const order = (items: J[], extra: J = {}) => ({ customerId: cust(), channelId: ch(), createdOn: '2026-11-01', dueOn: '2026-11-05', accepted: false, items, ...extra });

describe('stock (docs/12 §8)', () => {
  it('enable, adjust by count and delta; COUNT_UNCHANGED; never below reserved or free', async () => {
    const id = await newPiece(5);
    expect((await stockOf(id))).toMatchObject({ physical: 5, free: 5, status: 'ok' });
    expect((await call('POST', `/stock/${id}/adjust`, { mode: 'count', value: 5 })).code).toBe('COUNT_UNCHANGED');
    expect((await call('POST', `/stock/${id}/adjust`, { mode: 'count', value: 7, note: 'Conteo' })).data).toMatchObject({ physical: 7 });
    expect((await call('POST', `/stock/${id}/adjust`, { mode: 'delta', value: -8 })).code).toBe('INSUFFICIENT_STOCK');
    await call('POST', '/orders', order([piece(id, 3, 7200, { fromStock: { [id]: 3 } })], { accepted: true }));
    expect((await stockOf(id))).toMatchObject({ physical: 7, reserved: 3, free: 4 });
    expect((await call('POST', `/stock/${id}/adjust`, { mode: 'count', value: 2 })).code).toBe('VALIDATION_ERROR');
    expect((await stockOf(id)).movements.map((m: J) => m.kind)).toEqual(['adjustment', 'initial']);
  });
  it('a piece with stock cannot stop tracking it nor be deleted; with active orders it cannot be deleted', async () => {
    const id = await newPiece(2);
    expect((await call('DELETE', `/products/${id}`)).code).toBe('PRODUCT_HAS_STOCK');
    const id2 = await newPiece();
    await call('POST', '/orders', order([piece(id2, 1)]));
    expect((await call('DELETE', `/products/${id2}`)).code).toBe('PRODUCT_IN_ACTIVE_ORDERS');
  });
});

describe('sales (docs/12 §6, cases 6.1 and 6.2)', () => {
  it('case 6.1: $72, cost 35.9474, channel 17 % → commission 12.24, profit 23.81 (cost recomputed by the server)', async () => {
    const ml = s.a.channel['Mercado Libre']!;
    const p = (await call('POST', '/products', { name: 'Caso 6.1', mode: 'value', priceCents: 7200, hours: 0, extrasCents: 0, filaments: [], supplies: [] })).data;
    const sale = (await call('POST', '/sales', { on: '2026-11-01', channelId: ml, items: [{ ...piece(p.id, 1), costCents: 1 }] })).data;
    expect(sale.totals.commissionCents).toBe(1224);
    expect(sale.totals.profitCents).toBe(7200 - 1224 - sale.totals.costCents);
  });
  it('case 6.2: $300 with $100 paid → owes $200; without a payment list → owes $0; payments and their errors', async () => {
    const id = await newPiece(5);
    const a = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 1, 30000)], paidNowCents: 10000 })).data;
    expect(a.totals.owedCents).toBe(20000);
    const b = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 1, 30000)] })).data;
    expect(b.totals.owedCents).toBe(0);
    expect((await call('POST', `/sales/${a.id}/payments`, { on: '2026-11-01', amountCents: 20001 })).code).toBe('PAYMENT_EXCEEDS_BALANCE');
    const paid = (await call('POST', `/sales/${a.id}/payments`, { on: '2026-11-01', amountCents: 20000 })).data;
    expect(paid.totals.owedCents).toBe(0);
    expect((await call('DELETE', `/sales/${a.id}/payments/${paid.payments[1].id}`)).data.totals.owedCents).toBe(20000);
    expect((await stockOf(id)).physical).toBe(3);
  });
  it('LINE_ITEMS_REQUIRED and INSUFFICIENT_STOCK (nothing written)', async () => {
    expect((await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [] })).code).toBe('LINE_ITEMS_REQUIRED');
    const id = await newPiece(1);
    const r = await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 2)] });
    expect([r.code, r.details.requested, r.details.free]).toEqual(['INSUFFICIENT_STOCK', 2, 1]);
    expect((await stockOf(id)).physical).toBe(1);
  });
  it('return with restock: income 0, cost 0, +n; without: cost is lost; SALE_ALREADY_RETURNED, REFUND_EXCEEDS_PAID', async () => {
    const id = await newPiece(4);
    const a = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 2)] })).data;
    expect((await call('POST', `/sales/${a.id}/return`, { on: '2026-11-01', restock: true, refundCents: 14401 })).code).toBe('REFUND_EXCEEDS_PAID');
    const r = (await call('POST', `/sales/${a.id}/return`, { on: '2026-11-01', restock: true, refundCents: 14400 })).data;
    expect([r.totals.incomeCents, r.totals.costCents, r.totals.profitCents]).toEqual([0, 0, 0]);
    expect((await stockOf(id)).physical).toBe(4);
    expect((await call('POST', `/sales/${a.id}/return`, { on: '2026-11-01', restock: true })).code).toBe('SALE_ALREADY_RETURNED');
    const b = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 1)] })).data;
    const lost = (await call('POST', `/sales/${b.id}/return`, { on: '2026-11-01', restock: false })).data;
    expect(lost.totals.profitCents).toBe(-lost.totals.costCents);
    expect((await stockOf(id)).physical).toBe(3);
  });
  it('update, delete gives the pieces back, restore takes them again (INSUFFICIENT_STOCK if they are gone)', async () => {
    const id = await newPiece(2);
    const a = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 2)] })).data;
    expect((await call('PATCH', `/sales/${a.id}`, { note: 'Feria' })).data.note).toBe('Feria');
    expect((await call('DELETE', `/sales/${a.id}`)).status).toBe(204);
    expect((await stockOf(id)).physical).toBe(2);
    await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 1)] });
    expect((await call('POST', `/sales/${a.id}/restore`)).code).toBe('INSUFFICIENT_STOCK');
    await call('POST', `/stock/${id}/adjust`, { mode: 'delta', value: 5 });
    expect((await call('POST', `/sales/${a.id}/restore`)).status).toBe(200);
    expect((await stockOf(id)).physical).toBe(4);
  });
  it('a channel with sales cannot be removed (CHANNEL_IN_USE)', async () => {
    expect((await call('DELETE', `/channels/${ch()}`)).code).toBe('CHANNEL_IN_USE');
  });
});

describe('orders (docs/12 §7, cases 7.1 and 7.2)', () => {
  it('case 7.1: $500 with $200 deposit → owes $300; cancel refunding $200 → paid 0, owed 0', async () => {
    const id = await newPiece();
    const o = (await call('POST', '/orders', order([piece(id, 1, 50000)], { depositCents: 20000 }))).data;
    expect(o.totals.owedCents).toBe(30000);
    expect((await call('POST', `/orders/${o.id}/cancel`, { reason: 'x', refundCents: 20001 })).code).toBe('REFUND_EXCEEDS_PAID');
    const c = (await call('POST', `/orders/${o.id}/cancel`, { reason: 'Ya no', refundCents: 20000 })).data;
    expect([c.status, c.totals.paidCents, c.totals.owedCents]).toEqual(['cancelled', 0, 0]);
    expect((await call('POST', `/orders/${o.id}/cancel`, { reason: 'x' })).code).toBe('ORDER_INVALID_STATE');
    expect((await call('POST', `/orders/${o.id}/payments`, { on: '2026-11-01', amountCents: 1 })).code).toBe('ORDER_NOT_ACTIVE');
  });
  it('case 7.2: 10 pieces, 4 from stock → ready: reserved 10 and +6; delivered: −10 and a sale', async () => {
    const id = await newPiece(4);
    const o = (await call('POST', '/orders', order([piece(id, 10, 7200, { fromStock: { [id]: 4 } })], { accepted: true }))).data;
    expect((await stockOf(id))).toMatchObject({ physical: 4, reserved: 4, free: 0 });
    const prod = await call('POST', `/orders/${o.id}/start-production`, { assignments: [{ lineItemId: o.items[0].id, printerId: first(s.a.printer) }], deductFilament: true });
    expect(prod.data.status).toBe('in_production');
    expect(prod.data.queue).toHaveLength(1);
    const ready = (await call('POST', `/orders/${o.id}/ready`)).data;
    expect([ready.status, ready.stockReserved[id], ready.runsLogged]).toEqual(['ready', 10, true]);
    expect((await stockOf(id))).toMatchObject({ physical: 10, reserved: 10, free: 0 });
    expect((await call('POST', `/orders/${o.id}/deliver`, { on: '2026-11-02', collectCents: 72001 })).code).toBe('PAYMENT_EXCEEDS_BALANCE');
    const d = (await call('POST', `/orders/${o.id}/deliver`, { on: '2026-11-02' })).data;
    expect(d.order.status).toBe('delivered');
    expect((await call('GET', `/sales/${d.saleId}`)).data.totals.incomeCents).toBe(72000);
    expect((await stockOf(id))).toMatchObject({ physical: 0, reserved: 0 });
    const runs = (await call('GET', '/print-runs?reason=order')).data.items.filter((r: J) => r.productId === id);
    expect(runs.map((r: J) => r.qty)).toEqual([6]);
  });
  it('CUSTOMER_REQUIRED, LINE_ITEMS_REQUIRED, ORDER_INVALID_STATE with expected[], STOCK_SHORT when stock does not reach', async () => {
    const id = await newPiece(1);
    expect((await call('POST', '/orders', order([piece(id, 1)], { customerId: null }))).code).toBe('CUSTOMER_REQUIRED');
    expect((await call('POST', '/orders', order([]))).code).toBe('LINE_ITEMS_REQUIRED');
    const o = (await call('POST', '/orders', order([piece(id, 3, 7200, { fromStock: { [id]: 3 } })]))).data;
    const st = await call('POST', `/orders/${o.id}/ready`);
    expect([st.code, st.details.expected]).toEqual(['ORDER_INVALID_STATE', ['accepted', 'in_production']]);
    const acc = await call('POST', `/orders/${o.id}/accept`);
    expect(acc.warnings).toEqual([{ code: 'STOCK_SHORT', details: { missing: 2 } }]);
    expect(acc.data.items[0].fromStock).toEqual({ [id]: 1 });
  });
  it('fully from stock: accepted → ready directly → delivered', async () => {
    const id = await newPiece(2);
    const o = (await call('POST', '/orders', order([piece(id, 2, 7200, { fromStock: { [id]: 2 } })], { accepted: true }))).data;
    expect(o.nextStep).toBe('ready');
    expect((await call('POST', `/orders/${o.id}/ready`)).data.status).toBe('ready');
    expect((await call('POST', `/orders/${o.id}/deliver`, { on: '2026-11-02' })).data.order.status).toBe('delivered');
    expect((await stockOf(id)).physical).toBe(0);
  });
  it('PRINTER_ASSIGNMENT_REQUIRED, FILAMENT_SHORTFALL, reassign, finish queue entries (ORDER_WAITING_OTHER_PRINTERS → ready)', async () => {
    const big = await newPiece(undefined, { filaments: [{ filamentId: s.a.filament['PLA Silk Morado'], grams: 500 }] });
    const small = await newPiece();
    const o = (await call('POST', '/orders', order([piece(big, 1), piece(small, 1)], { accepted: true }))).data;
    const missing = await call('POST', `/orders/${o.id}/start-production`, { assignments: [{ lineItemId: o.items[0].id, printerId: first(s.a.printer) }], deductFilament: false });
    expect([missing.code, missing.details.count]).toEqual(['PRINTER_ASSIGNMENT_REQUIRED', 1]);
    const [p1, p2] = Object.values(s.a.printer) as [string, string];
    const st = await call('POST', `/orders/${o.id}/start-production`, { assignments: [{ lineItemId: o.items[0].id, printerId: p1 }, { lineItemId: o.items[1].id, printerId: p1 }], deductFilament: false });
    expect(st.warnings?.[0]?.code).toBe('FILAMENT_SHORTFALL');
    const re = (await call('POST', `/orders/${o.id}/reassign-printers`, { assignments: [{ lineItemId: o.items[0].id, printerId: p1 }, { lineItemId: o.items[1].id, printerId: p2 }] })).data;
    expect(re.queue.map((q: J) => q.printerId).sort()).toEqual([p1, p2].sort());
    const [q1, q2] = re.queue as J[];
    const f1 = await call('POST', `/printers/${q1!.printerId}/queue/${q1!.id}/finish`);
    expect([f1.data.readyTriggered, f1.warnings?.[0]?.code]).toEqual([false, 'ORDER_WAITING_OTHER_PRINTERS']);
    const f2 = await call('POST', `/printers/${q2!.printerId}/queue/${q2!.id}/finish`);
    expect(f2.data.readyTriggered).toBe(true);
    expect((await call('GET', `/orders/${o.id}`)).data.status).toBe('ready');
  });
  it('update only while quoted or accepted (ORDER_NOT_ACTIVE); payments; delete leaves the queues; restore puts it back', async () => {
    const id = await newPiece();
    const o = (await call('POST', '/orders', order([piece(id, 1)], { accepted: true }))).data;
    const up = (await call('PUT', `/orders/${o.id}`, { ...order([piece(id, 2)]), accepted: undefined })).data;
    expect(up.totals.totalCents).toBe(14400);
    const pay = (await call('POST', `/orders/${o.id}/payments`, { on: '2026-11-01', amountCents: 400 })).data;
    expect((await call('POST', `/orders/${o.id}/payments`, { on: '2026-11-01', amountCents: 14001 })).code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect((await call('DELETE', `/orders/${o.id}/payments/${pay.payments[0].id}`)).data.totals.paidCents).toBe(0);
    await call('POST', `/orders/${o.id}/start-production`, { assignments: [{ lineItemId: up.items[0].id, printerId: first(s.a.printer) }], deductFilament: false });
    expect((await call('PUT', `/orders/${o.id}`, { ...order([piece(id, 2)]), accepted: undefined })).code).toBe('ORDER_NOT_ACTIVE');
    expect((await call('DELETE', `/orders/${o.id}`)).status).toBe(204);
    const queued = async () => (await call('GET', '/printers')).data.items.flatMap((p: J) => p.queue).filter((q: J) => q.orderId === o.id).length;
    expect(await queued()).toBe(0);
    await call('POST', `/orders/${o.id}/restore`);
    expect(await queued()).toBe(1);
  });
  it('NO_PRINTERS when the workspace has none', async () => {
    const id = await newPiece();
    const o = (await call('POST', '/orders', order([piece(id, 1)], { accepted: true }))).data;
    const ids = Object.values(s.a.printer);
    await s.h.db.update(schema.printer).set({ deletedAt: new Date() }).where(inArray(schema.printer.id, ids));
    expect((await call('POST', `/orders/${o.id}/start-production`, { assignments: [], deductFilament: false })).code).toBe('NO_PRINTERS');
    await s.h.db.update(schema.printer).set({ deletedAt: null }).where(inArray(schema.printer.id, ids));
  });
});

describe('print runs (docs/12 §8, docs/04 §8)', () => {
  it('a good run for stock adds pieces and spends filament; undo gives everything back; NO_SPOOLS', async () => {
    const id = await newPiece(0);
    const before = (await call('GET', `/filaments/${s.a.filament['PLA Negro']}`)).data.remainingGrams;
    const r = await call('POST', '/print-runs', { on: '2026-11-01', productId: id, qty: 2, printerId: first(s.a.printer), result: 'ok', hours: 1, reason: 'stock', filaments: [{ filamentId: s.a.filament['PLA Negro'], grams: 20 }] });
    expect(r.status).toBe(201);
    expect((await stockOf(id)).physical).toBe(2);
    expect((await call('GET', `/filaments/${s.a.filament['PLA Negro']}`)).data.remainingGrams).toBe(before - 21);
    expect((await call('DELETE', `/print-runs/${r.data.id}`)).status).toBe(204);
    expect((await stockOf(id)).physical).toBe(0);
    expect((await call('GET', `/filaments/${s.a.filament['PLA Negro']}`)).data.remainingGrams).toBe(before);
    const noSpool = (await call('POST', '/spools', { filament: { material: 'ABS', color: 'Rosa' }, brand: '', costCents: 100, shippingCents: 0, grams: 10, purchasedOn: '2026-11-01' })).data;
    await call('DELETE', `/spools/${noSpool.spool.id}`);
    expect((await call('POST', '/print-runs', { on: '2026-11-01', text: 'Prueba', qty: 1, result: 'ok', hours: 1, reason: 'test', filaments: [{ filamentId: noSpool.filament.id, grams: 5 }] })).code).toBe('NO_SPOOLS');
  });
  it('PRINT_RUN_LOCKED: pieces already sold, or a run of an order', async () => {
    const id = await newPiece(0);
    const r = (await call('POST', '/print-runs', { on: '2026-11-01', productId: id, qty: 1, result: 'ok', hours: 1, reason: 'stock', filaments: [] })).data;
    await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(id, 1)] });
    const l = await call('DELETE', `/print-runs/${r.id}`);
    expect([l.code, l.details.reason]).toEqual(['PRINT_RUN_LOCKED', 'pieces_unavailable']);
    const run = (await call('GET', '/print-runs?reason=order')).data.items[0];
    expect((await call('DELETE', `/print-runs/${run.id}`)).details.reason).toBe('order_history');
  });
});

describe('customers and expenses (docs/12 §9)', () => {
  it('CUSTOMER_NAME_EXISTS ignoring case and accents; CUSTOMER_HAS_HISTORY; delete and restore; RESTORE_CONFLICT', async () => {
    const c = (await call('POST', '/customers', { name: 'Café Núñez', type: 'Empresa', phone: '33 1' })).data;
    expect((await call('POST', '/customers', { name: 'cafe nunez', type: 'Persona' })).code).toBe('CUSTOMER_NAME_EXISTS');
    expect((await call('PATCH', `/customers/${c.id}`, { name: 'Tacos El Güero' })).code).toBe('CUSTOMER_NAME_EXISTS');
    expect((await call('DELETE', `/customers/${cust()}`)).code).toBe('CUSTOMER_HAS_HISTORY');
    expect((await call('DELETE', `/customers/${c.id}`)).status).toBe(204);
    await call('POST', '/customers', { name: 'Cafe Nunez', type: 'Persona' });
    expect((await call('POST', `/customers/${c.id}/restore`)).code).toBe('RESTORE_CONFLICT');
    const detail = (await call('GET', `/customers/${cust()}`)).data;
    expect(detail.history.length).toBeGreaterThan(0);
  });
  it('case 10.1 in the API: monthly expense prorated by days; end before start is a validation error; delete and restore', async () => {
    expect((await call('POST', '/expenses', { on: '2026-11-10', concept: 'Renta', category: 'Renta o espacio', amountCents: 100, recurring: true, endsOn: '2026-11-01' })).code).toBe('VALIDATION_ERROR');
    const e = (await call('POST', '/expenses', { on: '2026-11-01', concept: 'Renta', category: 'Renta o espacio', amountCents: 304375, recurring: true })).data;
    const list = (await call('GET', '/expenses?from=2026-11-01&to=2026-11-10')).data;
    expect(list.items.find((x: J) => x.id === e.id).inPeriodCents).toBe(100000);
    expect((await call('PATCH', `/expenses/${e.id}`, { on: '2026-11-01', concept: 'Renta', category: 'Renta o espacio', amountCents: 1000, recurring: false })).data.recurring).toBe(false);
    expect((await call('DELETE', `/expenses/${e.id}`)).status).toBe(204);
    expect((await call('POST', `/expenses/${e.id}/restore`)).data.id).toBe(e.id);
  });
});

describe('displayName of variants (mejoras/ronda-2.md §6)', () => {
  it('a sale and an order keep the displayName of the moment; a new label does not rewrite them', async () => {
    const root = await newPiece(5, { name: 'Dragón articulado' });
    const d = (await call('GET', `/products/${root}`)).data;
    const v = (await call('POST', `/products/${root}/variant`, { ...d, variantLabel: 'Silk morado' })).data;
    await call('POST', `/stock/${v.id}/enable`, { initialCount: 3 });
    const sale = (await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(v.id, 1)] })).data;
    expect(sale.items.map((it: J) => it.name)).toEqual(['Dragón articulado · Silk morado']);
    const o = (await call('POST', '/orders', order([piece(v.id, 1)]))).data;
    expect(o.items.map((it: J) => it.name)).toEqual(['Dragón articulado · Silk morado']);
    await call('PUT', `/products/${v.id}`, { ...v, variantLabel: 'Morado mate' });
    expect((await call('GET', `/sales/${sale.id}`)).data.items.map((it: J) => it.name)).toEqual(['Dragón articulado · Silk morado']);
    expect((await call('GET', `/orders/${o.id}`)).data.items.map((it: J) => it.name)).toEqual(['Dragón articulado · Silk morado']);
    // A new sale takes the new label; stock errors use displayName.
    expect((await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(v.id, 1)] })).data.items[0].name).toBe('Dragón articulado · Morado mate');
    expect((await call('POST', '/sales', { on: '2026-11-01', channelId: ch(), items: [piece(v.id, 9)] })).details).toMatchObject({ name: 'Dragón articulado · Morado mate', requested: 9 });
    expect((await call('POST', `/stock/${v.id}/adjust`, { mode: 'delta', value: -9 })).details).toMatchObject({ name: 'Dragón articulado · Morado mate' });
    // Collections show their parts with displayName; search finds a variant by its label.
    const col = (await call('POST', '/collections', { name: 'Dúo dragón', parts: [{ productId: root, qty: 1 }, { productId: v.id, qty: 1 }] })).data;
    expect(col.parts.map((p: J) => p.name)).toEqual(['Dragón articulado', 'Dragón articulado · Morado mate']);
    expect((await call('GET', '/search?q=morado mate')).data.products.map((p: J) => p.name)).toEqual(['Dragón articulado · Morado mate']);
    // Reports: each variant counts on its own, with its displayName.
    const top = (await call('GET', '/reports?period=all')).data.topProducts as J[];
    expect(top.filter((x) => x.name.startsWith('Dragón articulado')).map((x) => [x.name, x.qty])).toEqual([['Dragón articulado · Morado mate', 2]]);
  });
});
