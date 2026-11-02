// Load set of docs/15 §1 ("five years of use"), deterministic, on top of a workspace that already has the
// mockup seed: 25 000 sales, 80 000 line items, 5 000 orders, 500 pieces, 2 000 customers, 20 printers,
// 400 spools / 150 filaments, 150 000 ledger rows and 20 000 print runs. Inserted in bulk with the repositories.
import { eq } from 'drizzle-orm';
import type { Ctx } from '../src/ctx';
import type { Db, Executor } from '../src/db';
import { transaction } from '../src/db';
import { insertFilament, insertSpool, insertSpoolMovements } from '../src/repos/filament-repo';
import { insertPrinter } from '../src/repos/printer-repo';
import { insertProduct, replaceProductParts } from '../src/repos/product-repo';
import { listChannels } from '../src/repos/settings-repo';
import {
  insertCustomer, insertLineItems, insertOrder, insertPayments, insertPrintRun, insertPrintRunFilaments, insertSale, insertStockMovements,
} from '../src/repos/sell-repo';
import { listSupplies, insertSupplyMovements } from '../src/repos/supply-repo';
import { schema } from '../src';

export const LOAD = { sales: 25_000, items: 80_000, orders: 5_000, products: 500, customers: 2_000, printers: 20, spools: 400, filaments: 150, ledger: 150_000, printRuns: 20_000 };

/** Small deterministic generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dayOf = (base: string, back: number) => new Date(Date.parse(`${base}T12:00:00Z`) - back * 864e5).toISOString().slice(0, 10);
async function chunks<T>(rows: T[], size: number, fn: (part: T[]) => Promise<unknown>) { for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size)); }

export async function generateLoad(db: Db, ctx: Ctx, opts: { today: string; nextId: () => string; scale?: number }) {
  const r = rng(42);
  const n = (x: number) => Math.max(1, Math.round(x * (opts.scale ?? 1)));
  const id = opts.nextId;
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const channels = await listChannels(db, ctx);
  const existing = await db.select({ id: schema.product.id }).from(schema.product).where(eq(schema.product.workspaceId, ctx.workspaceId));
  const supplies = (await listSupplies(db, ctx, { page: 1, pageSize: 1000 })).items;

  await transaction(db, async (tx: Executor) => {
    const filaments: string[] = [];
    for (let i = 0; i < n(LOAD.filaments); i++) filaments.push((await insertFilament(tx, ctx, { id: id(), material: 'PLA', color: `Carga ${i}`, hex: '#808080', nameKey: `pla|carga ${i}` })).id);
    const spools: string[] = [];
    for (let i = 0; i < n(LOAD.spools); i++) spools.push((await insertSpool(tx, ctx, { id: id(), filamentId: filaments[i % filaments.length]!, brand: 'Carga', costCents: 40000, shippingCents: 0, grams: 1000, purchasedOn: dayOf(opts.today, 1800 - i) })).id);
    const printers: string[] = [];
    for (let i = 0; i < n(LOAD.printers); i++) printers.push((await insertPrinter(tx, ctx, { id: id(), name: `Carga ${i}`, costCents: 800000, lifeHours: 5000, maintenanceCentsPerHour: 50, kw: 0.12, hours: 100 })).id);
    const products = existing.map((p) => p.id);
    for (let i = products.length; i < n(LOAD.products); i++) {
      const p = await insertProduct(tx, ctx, { id: id(), name: `Pieza de carga ${i}`, mode: 'value', priceCents: 5000 + (i % 40) * 1000, hours: 0.5 + (i % 6), printerId: pick(printers), tracksStock: i % 3 === 0 });
      await replaceProductParts(tx, ctx, p.id, [{ id: id(), filamentId: pick(filaments), grams: 10 + (i % 90) }], supplies.length && i % 4 === 0 ? [{ id: id(), supplyId: pick(supplies).id, qty: 1 }] : []);
      products.push(p.id);
    }
    const customers: string[] = [];
    await chunks(Array.from({ length: n(LOAD.customers) }, (_, i) => ({ id: id(), name: `Cliente de carga ${i}`, nameKey: `cliente de carga ${i}`, type: 'Persona', createdOn: dayOf(opts.today, 1800 - (i % 1800)) })), 500, async (rows) => { for (const c of rows) customers.push((await insertCustomer(tx, ctx, c)).id); });

    const orders = Array.from({ length: n(LOAD.orders) }, (_, i) => {
      const back = Math.floor(r() * 1800);
      const status = back > 30 ? (r() < 0.9 ? 'delivered' : 'cancelled') : pick(['quoted', 'accepted', 'in_production', 'ready'] as const);
      return { id: id(), number: 100_000 + i, customerId: pick(customers), status, channelId: pick(channels).id, createdOn: dayOf(opts.today, back), dueOn: dayOf(opts.today, back - 7) };
    });
    await chunks(orders, 500, async (rows) => { for (const o of rows) await insertOrder(tx, ctx, o); });
    const item = (parentKind: 'order' | 'sale', parentId: string, position: number) => {
      const q = 1 + Math.floor(r() * 5);
      return { id: id(), parentKind, parentId, position, kind: 'piece', productId: pick(products), name: 'Pieza de carga', qty: q, priceCents: 5000 + Math.floor(r() * 30) * 500, listCents: 6000, costCents: 1500 + r() * 2000, extrasCents: 0 };
    };
    const orderItems = orders.map((o) => item('order', o.id, 0));
    await chunks(orderItems, 1000, (rows) => insertLineItems(tx, ctx, rows));
    await chunks(orders.map((o) => ({ id: id(), parentKind: 'order', parentId: o.id, on: o.createdOn, amountCents: 5000, note: 'Anticipo' })), 1000, (rows) => insertPayments(tx, ctx, rows));

    const sales = Array.from({ length: n(LOAD.sales) }, () => ({ id: id(), on: dayOf(opts.today, Math.floor(r() * 1800)), channelId: pick(channels).id, customerId: r() < 0.5 ? pick(customers) : null, note: '', tracksPayments: r() < 0.1 }));
    await chunks(sales, 1000, async (rows) => { for (const s of rows) await insertSale(tx, ctx, s); });
    const perSale = Math.max(1, Math.round((n(LOAD.items) - orderItems.length) / sales.length));
    const saleItems = sales.flatMap((s) => Array.from({ length: perSale }, (_, k) => item('sale', s.id, k)));
    await chunks(saleItems, 1000, (rows) => insertLineItems(tx, ctx, rows));
    await chunks(sales.filter((s) => s.tracksPayments).map((s) => ({ id: id(), parentKind: 'sale', parentId: s.id, on: s.on, amountCents: 1000, note: 'Abono' })), 1000, (rows) => insertPayments(tx, ctx, rows));

    const runs = Array.from({ length: n(LOAD.printRuns) }, () => ({ id: id(), on: dayOf(opts.today, Math.floor(r() * 1800)), productId: pick(products), qty: 1, printerId: pick(printers), result: r() < 0.9 ? 'ok' : 'fail', hours: 1 + Math.floor(r() * 5), reason: 'test' }));
    await chunks(runs, 1000, async (rows) => { for (const x of rows) await insertPrintRun(tx, ctx, x); });
    await chunks(runs.map((x) => ({ id: id(), printRunId: x.id, filamentId: pick(filaments), grams: 20 })), 1000, (rows) => insertPrintRunFilaments(tx, ctx, rows));

    const third = Math.round(n(LOAD.ledger) / 3);
    await chunks(Array.from({ length: third }, (_, i) => ({ id: id(), spoolId: spools[i % spools.length]!, on: dayOf(opts.today, 1800 - (i % 1800)), kind: i < spools.length ? 'purchase' : 'consumption', grams: i < spools.length ? 1000 : -0.1, note: '' })), 2000, (rows) => insertSpoolMovements(tx, ctx, rows));
    const tracked = products.filter((_, i) => i % 3 === 0);
    await chunks(Array.from({ length: third }, (_, i) => ({ id: id(), productId: tracked[i % tracked.length]!, on: dayOf(opts.today, 1800 - (i % 1800)), kind: i % 2 ? 'sale' : 'print', qty: i % 2 ? -1 : 2, note: '' })), 2000, (rows) => insertStockMovements(tx, ctx, rows));
    if (supplies.length) await chunks(Array.from({ length: third }, (_, i) => ({ id: id(), supplyId: supplies[i % supplies.length]!.id, on: dayOf(opts.today, 1800 - (i % 1800)), kind: i % 2 ? 'use' : 'purchase', qty: i % 2 ? -1 : 1, note: '' })), 2000, (rows) => insertSupplyMovements(tx, ctx, rows));
  });
  await db.execute('ANALYZE');
}
