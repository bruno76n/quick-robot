// Pedidos (docs/04 §7, docs/06 §5–6, docs/12 §7): states, reservations, queues, ready and delivery.
import {
  BusinessError, type AssignmentsInput, type CancelInput, type DeliverInput, type OrderInput, type OrderUpdateInput, type PaymentInput,
  type StartProductionInput, type Warning,
} from '@app/contract';
import {
  allowedFrom, isActive, itemMaterial, itemToPrint, itemToPrintCount, nextStep, orderCommission, orderCost, orderOwed, orderPaid, orderProfit, orderTotal,
  planDelivery, planReady, printRunEffects, reserveForOrder, type OrderStatus, type OrderStep,
} from '@app/core';
import {
  addPrinterHours, deleteLineItems, deletePayment, getChannel, getCustomer, getOrder, getPrinter, insertLineItems, insertOrder, insertPayments,
  insertPrintRun, insertPrintRunFilaments, insertSale, insertStockMovements, listChannels, listCustomers, listOrders, listPrinters, listProducts,
  listQueue, nextOrderNumber, setOrderDeleted, transaction, updateLineItem, updateOrder, type Ctx, type Executor, type LineItemRow, type OrderRow,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { buildItems, cents, childrenOf, commissionOf, itemsText, lineItemData, loadStock, orderData } from './common';
import { deductFilament, shortfall, useSupplies } from './material';
import { dequeue, enqueue, queueViews } from './queue';

type Result<T> = { data: T; warnings: Warning[] };

function assertState(o: OrderRow, step: OrderStep | 'cancel' | 'reassign', items: readonly LineItemRow[]) {
  const expected = allowedFrom(step, { status: o.status as OrderStatus, items: items.map(lineItemData) });
  if (!expected.includes(o.status as OrderStatus)) throw new BusinessError('ORDER_INVALID_STATE', { status: o.status, expected });
}

async function load(tx: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}) {
  const o = await getOrder(tx, ctx, id, { ...opts, forUpdate: true });
  if (!o) throw notFound('order');
  const ch = await childrenOf(tx, ctx, 'order', [id]);
  return { o, items: ch.items(id), payments: ch.payments(id) };
}

const materialOf = (items: readonly LineItemRow[], products: Awaited<ReturnType<typeof listProducts>>) => {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Record<string, number> = {};
  for (const it of items) for (const [f, g] of Object.entries(itemMaterial(lineItemData(it), (id) => byId.get(id)?.filaments ?? []))) out[f] = (out[f] ?? 0) + g;
  return out;
};

// ---------- Reads ----------
export async function orderList(deps: Deps, ex: Executor, ctx: Ctx, f: { statuses?: readonly string[] | undefined; view?: string | undefined; month?: string | undefined; customerId?: string | undefined; q?: string | undefined; page: number; pageSize: number }) {
  const channels = await listChannels(ex, ctx);
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((c) => [c.id, c.name]));
  let rows = await listOrders(ex, ctx, {
    statuses: f.statuses, customerId: f.customerId,
    ...(f.month ? { dueFrom: `${f.month}-01`, dueTo: `${f.month}-31` } : {}),
  });
  if (f.view === 'board') {
    const delivered = rows.filter((o) => o.status === 'delivered').sort((a, b) => (b.deliveredOn ?? '').localeCompare(a.deliveredOn ?? '') || b.number - a.number).slice(0, 3);
    rows = [...rows.filter((o) => isActive(o.status as OrderStatus)), ...delivered];
  }
  const ch = await childrenOf(ex, ctx, 'order', rows.map((o) => o.id));
  const needle = f.q?.trim().toLocaleLowerCase('es');
  if (needle) rows = rows.filter((o) => [`#${o.number}`, String(o.number), o.note, customers.get(o.customerId) ?? '', itemsText(ch.items(o.id))].some((t) => t.toLocaleLowerCase('es').includes(needle)));
  const queues = await queueViews(ex, ctx, {}, deps.clock.now());
  const printerNames = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const all = rows.map((o) => {
    const d = orderData(o, ch.items(o.id), ch.payments(o.id), commissionOf(channels, o.channelId));
    const jobs = [...queues].flatMap(([printerId, list]) => list.filter((q) => q.orderId === o.id).map((q) => ({ ...q, printerId, printerName: printerNames.get(printerId) ?? '' })));
    const toPrint = d.items.reduce((a, it) => a + itemToPrintCount(it), 0);
    const pieces = d.items.reduce((a, it) => a + (it.kind === 'set' ? (it.parts ?? []).reduce((x, p) => x + p.qty, 0) * it.qty : it.qty), 0);
    return {
      id: o.id, number: o.number, customerId: o.customerId, customer: customers.get(o.customerId) ?? '', status: o.status, createdOn: o.createdOn, dueOn: o.dueOn,
      readyOn: o.readyOn, deliveredOn: o.deliveredOn, channel: channels.find((c) => c.id === o.channelId)?.name ?? '', itemsText: itemsText(ch.items(o.id)),
      totalCents: cents(orderTotal(d)), paidCents: cents(orderPaid(d)), owedCents: cents(orderOwed(d)), profitCents: cents(orderProfit(d)),
      origins: { fromStock: pieces - toPrint, toPrint }, queueProgress: jobs.length ? Math.round(jobs.reduce((a, j) => a + j.progress, 0) / jobs.length) : null,
      queueRemainingMinutes: jobs.length ? Math.max(...jobs.map((j) => j.waitMinutes + j.remainingMinutes)) : null, nextStep: nextStep(d),
      // Board cards show each item and where its pieces are (docs/06 §5).
      items: ch.items(o.id).map((r) => ({ kind: r.kind, productId: r.productId, name: r.name, qty: r.qty, totalCents: r.qty * r.priceCents, parts: (r.parts ?? []).map((p) => ({ productId: p.productId, name: p.name, qty: p.qty })), fromStock: r.fromStock ?? {}, printerId: r.printerId })),
      jobs: jobs.map((j) => ({ printerId: j.printerId, printerName: j.printerName, progress: j.progress, remainingMinutes: j.remainingMinutes, waitMinutes: j.waitMinutes, position: j.position })),
    };
  });
  return { items: all.slice((f.page - 1) * f.pageSize, f.page * f.pageSize), page: f.page, pageSize: f.pageSize, total: all.length };
}

export async function orderDetail(deps: Deps, ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}) {
  const o = await getOrder(ex, ctx, id, opts);
  if (!o) throw notFound('order');
  const channels = await listChannels(ex, ctx);
  const ch = await childrenOf(ex, ctx, 'order', [id]);
  const d = orderData(o, ch.items(id), ch.payments(id), commissionOf(channels, o.channelId));
  const customer = await getCustomer(ex, ctx, o.customerId) ?? null;
  const products = await listProducts(ex, ctx);
  const printers = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const queues = await queueViews(ex, ctx, { orderId: id }, deps.clock.now());
  const st = await loadStock(ex, ctx, products);
  const mat = materialOf(ch.items(id), products);
  const warn = o.status === 'accepted' || o.status === 'quoted' ? await shortfall(ex, ctx, mat) : null;
  return {
    id: o.id, number: o.number, status: o.status, customerId: o.customerId, customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, type: customer.type } : null,
    channelId: o.channelId, channel: channels.find((c) => c.id === o.channelId)?.name ?? '', commissionPct: d.commissionPct, note: o.note,
    createdOn: o.createdOn, dueOn: o.dueOn, productionOn: o.productionOn, readyOn: o.readyOn, deliveredOn: o.deliveredOn,
    filamentDeducted: o.filamentDeducted, runsLogged: o.runsLogged, stockReserved: o.stockReserved, cancellation: o.cancellation,
    items: ch.items(id).map((r) => {
      const it = lineItemData(r);
      const toPrint = itemToPrintCount(it);
      return {
        id: r.id, kind: r.kind, productId: r.productId, collectionId: r.collectionId, name: r.name, qty: r.qty, priceCents: r.priceCents, listCents: r.listCents,
        costCents: Math.round(r.costCents), extrasCents: r.extrasCents, totalCents: r.qty * r.priceCents, parts: (r.parts ?? []).map((p) => ({ ...p, costCents: Math.round(p.costCents) })),
        fromStock: r.fromStock ?? {}, toPrint, printerId: r.printerId, printerName: r.printerId ? printers.get(r.printerId) ?? null : null,
        freeNow: Object.fromEntries(Object.keys({ ...(r.productId ? { [r.productId]: 1 } : {}), ...Object.fromEntries((r.parts ?? []).map((p) => [p.productId, 1])) }).map((pid) => [pid, st.free(pid, id)])),
      };
    }),
    payments: ch.payments(id).map((p) => ({ id: p.id, on: p.on, amountCents: p.amountCents, note: p.note })),
    totals: { totalCents: cents(orderTotal(d)), commissionCents: cents(orderCommission(d)), costCents: cents(orderCost(d)), profitCents: cents(orderProfit(d)), paidCents: cents(orderPaid(d)), owedCents: cents(orderOwed(d)) },
    queue: [...queues].flatMap(([printerId, list]) => list.map((q) => ({ ...q, printerId, printerName: printers.get(printerId) ?? '' }))),
    material: { needs: Object.entries(mat).map(([filamentId, grams]) => ({ filamentId, grams: Math.round(grams * 10) / 10 })), shortfall: (warn?.details?.items as unknown[]) ?? [] },
    nextStep: nextStep(d),
  };
}

// ---------- Writes ----------
async function assertRefs(tx: Executor, ctx: Ctx, input: { customerId?: string | null | undefined; channelId: string }) {
  if (!input.customerId) throw new BusinessError('CUSTOMER_REQUIRED');
  if (!(await getCustomer(tx, ctx, input.customerId))) throw notFound('customer');
  if (!(await getChannel(tx, ctx, input.channelId))) throw notFound('channel');
}

/** Accepting reserves what was planned; what does not reach is printed (STOCK_SHORT). */
async function reserve(tx: Executor, ctx: Ctx, orderId: string, items: readonly LineItemRow[]): Promise<Warning[]> {
  const st = await loadStock(tx, ctx);
  const { fromStock, missing } = reserveForOrder(items.map(lineItemData), (id) => st.free(id, orderId));
  for (const [k, it] of items.entries()) {
    const fs = fromStock[k] ?? null;
    if (JSON.stringify(fs) !== JSON.stringify(it.fromStock ?? null)) await updateLineItem(tx, ctx, it.id, { fromStock: fs });
  }
  return missing > 0 ? [{ code: 'STOCK_SHORT', details: { missing } }] : [];
}

export async function createOrder(deps: Deps, ctx: Ctx, input: OrderInput): Promise<Result<Awaited<ReturnType<typeof orderDetail>>>> {
  const { id, warnings } = await transaction(deps.db, async (tx) => {
    await assertRefs(tx, ctx, input);
    const id = deps.ids.next();
    const items = await buildItems(tx, ctx, input.items, () => deps.ids.next(), { keepFromStock: true });
    const number = await nextOrderNumber(tx, ctx);
    await insertOrder(tx, ctx, { id, number, customerId: input.customerId!, status: input.accepted ? 'accepted' : 'quoted', channelId: input.channelId, note: input.note?.trim() ?? '', createdOn: input.createdOn, dueOn: input.dueOn });
    const rows = await insertLineItems(tx, ctx, items.map((it) => ({ ...it, parentKind: 'order', parentId: id })));
    const total = items.reduce((a, it) => a + it.qty * it.priceCents, 0);
    const deposit = Math.min(total, input.depositCents ?? 0);
    if (deposit > 0) await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'order', parentId: id, on: input.createdOn, amountCents: deposit, note: 'Anticipo' }]);
    return { id, warnings: input.accepted ? await reserve(tx, ctx, id, rows) : [] };
  });
  return { data: await orderDetail(deps, deps.db, ctx, id), warnings };
}

/** Editing is for orders not yet in production (quoted or accepted), as in the mockup. */
export async function updateOrderUc(deps: Deps, ctx: Ctx, id: string, input: OrderUpdateInput): Promise<Result<Awaited<ReturnType<typeof orderDetail>>>> {
  const warnings = await transaction(deps.db, async (tx) => {
    const { o } = await load(tx, ctx, id);
    if (o.status !== 'quoted' && o.status !== 'accepted') throw new BusinessError('ORDER_NOT_ACTIVE', { status: o.status });
    await assertRefs(tx, ctx, input);
    const items = await buildItems(tx, ctx, input.items, () => deps.ids.next(), { keepFromStock: true });
    await updateOrder(tx, ctx, id, { customerId: input.customerId!, channelId: input.channelId, createdOn: input.createdOn, dueOn: input.dueOn, note: input.note?.trim() ?? '' });
    await deleteLineItems(tx, ctx, 'order', id);
    const rows = await insertLineItems(tx, ctx, items.map((it) => ({ ...it, parentKind: 'order', parentId: id })));
    return o.status === 'accepted' ? reserve(tx, ctx, id, rows) : [];
  });
  return { data: await orderDetail(deps, deps.db, ctx, id), warnings };
}

export async function acceptOrder(deps: Deps, ctx: Ctx, id: string): Promise<Result<Awaited<ReturnType<typeof orderDetail>>>> {
  const warnings = await transaction(deps.db, async (tx) => {
    const { o, items } = await load(tx, ctx, id);
    assertState(o, 'accept', items);
    await updateOrder(tx, ctx, id, { status: 'accepted' });
    return reserve(tx, ctx, id, items);
  });
  return { data: await orderDetail(deps, deps.db, ctx, id), warnings };
}

async function assign(tx: Executor, ctx: Ctx, items: readonly LineItemRow[], input: AssignmentsInput) {
  const printers = await listPrinters(tx, ctx);
  if (!printers.length) throw new BusinessError('NO_PRINTERS');
  const map = new Map(input.assignments.map((a) => [a.lineItemId, a.printerId]));
  for (const pid of new Set(map.values())) if (!printers.some((p) => p.id === pid)) throw notFound('printer');
  const missing = items.filter((it) => itemToPrintCount(lineItemData(it)) > 0 && !map.has(it.id)).map((it) => it.id);
  if (missing.length) throw new BusinessError('PRINTER_ASSIGNMENT_REQUIRED', { count: missing.length, lineItemIds: missing });
  const out: LineItemRow[] = [];
  for (const it of items) {
    const printerId = itemToPrintCount(lineItemData(it)) > 0 ? map.get(it.id)! : null;
    out.push(printerId === it.printerId ? it : (await updateLineItem(tx, ctx, it.id, { printerId }))!);
  }
  return out;
}

export async function startProduction(deps: Deps, ctx: Ctx, id: string, input: StartProductionInput): Promise<Result<Awaited<ReturnType<typeof orderDetail>>>> {
  const warnings = await transaction(deps.db, async (tx) => {
    const { o, items } = await load(tx, ctx, id);
    assertState(o, 'start_production', items);
    const assigned = await assign(tx, ctx, items, input);
    const products = await listProducts(tx, ctx);
    await enqueue(tx, ctx, o, assigned, products, deps.clock.now(), () => deps.ids.next());
    const mat = materialOf(assigned, products);
    const warn = await shortfall(tx, ctx, mat);
    if (input.deductFilament) await deductFilament(tx, ctx, mat, { on: deps.clock.today(), note: `Pedido #${o.number}`, refId: o.id, nextId: () => deps.ids.next() });
    await updateOrder(tx, ctx, id, { status: 'in_production', productionOn: deps.clock.today(), filamentDeducted: input.deductFilament });
    return warn ? [warn] : [];
  });
  return { data: await orderDetail(deps, deps.db, ctx, id), warnings };
}

export async function reassignPrinters(deps: Deps, ctx: Ctx, id: string, input: AssignmentsInput) {
  await transaction(deps.db, async (tx) => {
    const { o, items } = await load(tx, ctx, id);
    assertState(o, 'reassign', items);
    const assigned = await assign(tx, ctx, items, input);
    await dequeue(tx, ctx, { orderId: id }, deps.clock.now());
    await enqueue(tx, ctx, o, assigned, await listProducts(tx, ctx), deps.clock.now(), () => deps.ids.next());
  });
  return orderDetail(deps, deps.db, ctx, id);
}

/** Print runs of an order that deducted filament: one per piece, reason "order", with supplies and printer hours. */
async function logOrderRuns(deps: Deps, tx: Executor, ctx: Ctx, o: OrderRow, items: readonly LineItemRow[]) {
  const products = new Map((await listProducts(tx, ctx)).map((p) => [p.id, p]));
  for (const it of items) {
    const data = lineItemData(it);
    for (const [pid, n] of Object.entries(itemToPrint(data))) {
      const p = products.get(pid);
      if (!p) continue;
      const hours = Math.round(p.hours * n * 100) / 100;
      const run = await insertPrintRun(tx, ctx, { id: deps.ids.next(), on: deps.clock.today(), productId: pid, qty: n, printerId: it.printerId, result: 'ok', hours, reason: 'order', orderId: o.id, text: '' });
      await insertPrintRunFilaments(tx, ctx, p.filaments.filter((f) => f.grams > 0).map((f) => ({ id: deps.ids.next(), printRunId: run.id, filamentId: f.filamentId, grams: Math.round(f.grams * n * 10) / 10 })));
      const fx = printRunEffects({ result: 'ok', reason: 'order', qty: n, tracksStock: p.tracksStock }, p.supplies.map((s) => ({ supplyId: s.supplyId, qty: s.qty })));
      await useSupplies(tx, ctx, fx.supplyUse, { on: deps.clock.today(), note: `Pedido #${o.number}`, refId: run.id, nextId: () => deps.ids.next() });
      if (it.printerId && (await getPrinter(tx, ctx, it.printerId))) await addPrinterHours(tx, ctx, it.printerId, hours);
    }
  }
}

/** Ready: out of the queues, runs logged if filament was deducted, needed pieces reserved, printed ones into stock (case 7.2). */
export async function markReadyIn(deps: Deps, tx: Executor, ctx: Ctx, id: string) {
  const { o, items } = await load(tx, ctx, id);
  assertState(o, 'ready', items);
  await dequeue(tx, ctx, { orderId: id }, deps.clock.now());
  if (o.filamentDeducted && !o.runsLogged) await logOrderRuns(deps, tx, ctx, o, items);
  const tracks = new Map((await listProducts(tx, ctx)).map((p) => [p.id, p.tracksStock]));
  const plan = planReady(items.map(lineItemData), (pid) => tracks.get(pid) ?? false);
  await insertStockMovements(tx, ctx, plan.movements.map((m) => ({ id: deps.ids.next(), productId: m.productId, on: deps.clock.today(), kind: 'order_print', qty: m.qty, note: `Pedido #${o.number}`, refId: o.id })));
  await updateOrder(tx, ctx, id, { status: 'ready', readyOn: deps.clock.today(), stockReserved: plan.reserved, runsLogged: o.runsLogged || o.filamentDeducted });
}

export async function markOrderReady(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, (tx) => markReadyIn(deps, tx, ctx, id));
  return orderDetail(deps, deps.db, ctx, id);
}

/** Delivery: final payment, the sale is created with a copy of the items, reserved pieces leave stock. */
export async function deliverOrder(deps: Deps, ctx: Ctx, id: string, input: DeliverInput) {
  const saleId = await transaction(deps.db, async (tx) => {
    const { o, items, payments } = await load(tx, ctx, id);
    assertState(o, 'deliver', items);
    const d = orderData(o, items, payments, 0);
    const owed = cents(orderOwed(d));
    const collect = input.collectCents ?? owed;
    if (collect > owed) throw new BusinessError('PAYMENT_EXCEEDS_BALANCE', { balanceCents: owed });
    if (collect > 0) await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'order', parentId: id, on: input.on, amountCents: collect, note: 'Al entregar' }]);
    await updateOrder(tx, ctx, id, { status: 'delivered', deliveredOn: input.on });
    const saleId = deps.ids.next();
    await insertSale(tx, ctx, { id: saleId, on: input.on, channelId: o.channelId, customerId: o.customerId, orderId: o.id, note: input.note?.trim() || `Pedido #${o.number}` });
    await insertLineItems(tx, ctx, items.map((it) => ({
      id: deps.ids.next(), parentKind: 'sale', parentId: saleId, position: it.position, kind: it.kind, productId: it.productId, collectionId: it.collectionId, name: it.name,
      qty: it.qty, priceCents: it.priceCents, listCents: it.listCents, costCents: it.costCents, extrasCents: it.extrasCents, parts: it.parts, printerId: null, fromStock: null,
    })));
    await insertStockMovements(tx, ctx, planDelivery(o.stockReserved ?? {}).map((m) => ({ id: deps.ids.next(), productId: m.productId, on: input.on, kind: 'delivery', qty: m.qty, note: `Pedido #${o.number}`, refId: o.id })));
    return saleId;
  });
  return { order: await orderDetail(deps, deps.db, ctx, id), saleId };
}

export async function cancelOrder(deps: Deps, ctx: Ctx, id: string, input: CancelInput) {
  await transaction(deps.db, async (tx) => {
    const { o, items, payments } = await load(tx, ctx, id);
    assertState(o, 'cancel', items);
    const paid = cents(orderPaid(orderData(o, items, payments, 0)));
    const refund = input.refundCents ?? 0;
    if (refund > paid) throw new BusinessError('REFUND_EXCEEDS_PAID', { paidCents: paid });
    await dequeue(tx, ctx, { orderId: id }, deps.clock.now());
    if (refund > 0) await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'order', parentId: id, on: deps.clock.today(), amountCents: -refund, note: 'Reembolso' }]);
    await updateOrder(tx, ctx, id, { status: 'cancelled', cancellation: { on: deps.clock.today(), reason: input.reason.trim(), refundCents: refund } });
  });
  return orderDetail(deps, deps.db, ctx, id);
}

export async function recordOrderPayment(deps: Deps, ctx: Ctx, id: string, input: PaymentInput) {
  await transaction(deps.db, async (tx) => {
    const { o, items, payments } = await load(tx, ctx, id);
    if (!isActive(o.status as OrderStatus)) throw new BusinessError('ORDER_NOT_ACTIVE', { status: o.status });
    const owed = cents(orderOwed(orderData(o, items, payments, 0)));
    if (input.amountCents > owed) throw new BusinessError('PAYMENT_EXCEEDS_BALANCE', { balanceCents: owed });
    await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'order', parentId: id, on: input.on, amountCents: input.amountCents, note: input.note?.trim() || 'Abono' }]);
  });
  return orderDetail(deps, deps.db, ctx, id);
}

export async function deleteOrderPayment(deps: Deps, ctx: Ctx, id: string, paymentId: string) {
  await transaction(deps.db, async (tx) => {
    const { o } = await load(tx, ctx, id);
    if (!isActive(o.status as OrderStatus)) throw new BusinessError('ORDER_NOT_ACTIVE', { status: o.status });
    if (!(await deletePayment(tx, ctx, 'order', id, paymentId))) throw notFound('payment');
  });
  return orderDetail(deps, deps.db, ctx, id);
}

export async function deleteOrder(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    await load(tx, ctx, id);
    await dequeue(tx, ctx, { orderId: id }, deps.clock.now());
    await setOrderDeleted(tx, ctx, id, deps.clock.now());
  });
}

/** Restoring puts an order in production back in the queues of the printers it had. */
export async function restoreOrder(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    const { o, items } = await load(tx, ctx, id, { deleted: true });
    await setOrderDeleted(tx, ctx, id, null);
    if (o.status === 'accepted' || o.status === 'in_production') await reserve(tx, ctx, id, items);
    if (o.status === 'in_production' && !(await listQueue(tx, ctx, { orderId: id })).length) await enqueue(tx, ctx, o, items, await listProducts(tx, ctx), deps.clock.now(), () => deps.ids.next());
  });
  return orderDetail(deps, deps.db, ctx, id);
}
