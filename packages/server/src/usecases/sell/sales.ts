// Ventas (docs/04 §6, docs/06 §4, docs/12 §6).
import { BusinessError, type PaymentInput, type ReturnSaleInput, type SaleInput, type SalePatch } from '@app/contract';
import { itemTotal, saleCommission, saleCost, saleGross, saleIncome, saleOwed, salePaid, saleProfit } from '@app/core';
import {
  deletePayment, getChannel, getCustomer, getSale, insertLineItems, insertPayments, insertSale, insertStockMovements, listChannels, listCustomers,
  listOrders, listProducts, saleFacts, saleTotals, setSaleDeleted, stockMovementsByRef, transaction, updateSale, type Ctx, type Executor, type SaleFilter, type SaleRow,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { displayNames } from '../../views/costing';
import { totalsOf } from './fast';
import { assertStock, buildItems, cents, childrenOf, commissionOf, factSale, lineItemData, loadStock, needOf, saleData } from './common';

async function context(ex: Executor, ctx: Ctx) {
  const channels = await listChannels(ex, ctx);
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((c) => [c.id, c.name]));
  const numbers = async (ids: readonly (string | null)[]) => {
    const want = ids.filter((x): x is string => !!x);
    return new Map((await listOrders(ex, ctx, { ids: want })).map((o) => [o.id, o.number]));
  };
  return { channels, customers, numbers, channelName: (id: string) => channels.find((c) => c.id === id)?.name ?? '' };
}

/** One page of sales (SQL page and SQL totals over the whole filter: docs/15 §3). */
export async function saleList(_deps: Deps, ex: Executor, ctx: Ctx, f: SaleFilter & { q?: string | undefined; page: number; pageSize: number }) {
  const { channels, customers, numbers, channelName } = await context(ex, ctx);
  const rows = await saleFacts(ex, ctx, { ...f, limit: f.pageSize, offset: (f.page - 1) * f.pageSize });
  const folios = await numbers(rows.map((s) => s.orderId));
  const ch = await childrenOf(ex, ctx, 'sale', rows.map((s) => s.id));
  const t = totalsOf((await saleTotals(ex, ctx, f))[0]);
  const items = rows.map((s) => {
    const d = factSale(s, commissionOf(channels, s.channelId));
    const its = ch.items(s.id).map(lineItemData);
    return {
      id: s.id, on: s.on, channelId: s.channelId, channel: channelName(s.channelId), customerId: s.customerId, customer: s.customerId ? customers.get(s.customerId) ?? '' : '',
      itemsText: s.itemsText, note: s.note, totalCents: Math.round(s.grossCents), incomeCents: cents(saleIncome(d)), costCents: cents(saleCost(d)),
      commissionCents: cents(saleCommission(d)), profitCents: cents(saleProfit(d)), owedCents: cents(saleOwed(d)), returned: !!s.return, orderId: s.orderId, orderNumber: s.orderId ? folios.get(s.orderId) ?? null : null,
      pieces: s.pieces, listCents: Math.round(s.listCents),
      items: its.map((it) => ({ kind: it.kind, name: it.name, qty: it.qty, parts: (it.parts ?? []).map((p) => ({ name: p.name, qty: p.qty })) })),
    };
  });
  return { items, page: f.page, pageSize: f.pageSize, total: t.count, totals: { count: t.count, incomeCents: t.incomeCents, profitCents: t.profitCents, costCents: t.costCents, owedCents: t.owedCents } };
}

export async function saleDetail(_deps: Deps, ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}) {
  const s = await getSale(ex, ctx, id, opts);
  if (!s) throw notFound('sale');
  const { channels, customers, numbers, channelName } = await context(ex, ctx);
  const folios = await numbers([s.orderId]);
  const ch = await childrenOf(ex, ctx, 'sale', [id]);
  const d = saleData(s, ch.items(id), ch.payments(id), commissionOf(channels, s.channelId));
  return {
    id: s.id, on: s.on, channelId: s.channelId, channel: channelName(s.channelId), commissionPct: d.commissionPct, customerId: s.customerId,
    customer: s.customerId ? customers.get(s.customerId) ?? '' : '', orderId: s.orderId, orderNumber: s.orderId ? folios.get(s.orderId) ?? null : null, note: s.note, tracksPayments: s.tracksPayments,
    return: s.return,
    items: ch.items(id).map((r) => ({
      id: r.id, kind: r.kind, productId: r.productId, collectionId: r.collectionId, name: r.name, qty: r.qty, priceCents: r.priceCents, listCents: r.listCents,
      costCents: Math.round(r.costCents), extrasCents: r.extrasCents, totalCents: cents(itemTotal(lineItemData(r))), parts: (r.parts ?? []).map((p) => ({ ...p, costCents: Math.round(p.costCents) })),
    })),
    payments: ch.payments(id).map((p) => ({ id: p.id, on: p.on, amountCents: p.amountCents, note: p.note })),
    totals: { grossCents: cents(saleGross(d)), incomeCents: cents(saleIncome(d)), commissionCents: cents(saleCommission(d)), costCents: cents(saleCost(d)), profitCents: cents(saleProfit(d)), paidCents: cents(salePaid(d)), owedCents: cents(saleOwed(d)) },
  };
}

async function assertRefs(tx: Executor, ctx: Ctx, channelId?: string, customerId?: string | null) {
  if (channelId && !(await getChannel(tx, ctx, channelId))) throw notFound('channel');
  if (customerId && !(await getCustomer(tx, ctx, customerId))) throw notFound('customer');
}

/** Pieces that track stock leave the shelf ("sale" movements); the check uses the free pieces. */
async function takeFromShelf(deps: Deps, tx: Executor, ctx: Ctx, saleId: string, items: readonly ReturnType<typeof lineItemData>[], on: string, note: string) {
  const products = await listProducts(tx, ctx);
  const st = await loadStock(tx, ctx, products);
  const need = needOf(items);
  assertStock(need, st, displayNames(products));
  await insertStockMovements(tx, ctx, Object.entries(need).filter(([id, n]) => st.tracks.get(id) && n > 0)
    .map(([productId, n]) => ({ id: deps.ids.next(), productId, on, kind: 'sale', qty: -n, note: note || 'Venta', refId: saleId })));
}

export async function createSale(deps: Deps, ctx: Ctx, input: SaleInput) {
  const id = await transaction(deps.db, async (tx) => {
    await assertRefs(tx, ctx, input.channelId, input.customerId);
    const id = deps.ids.next();
    const items = await buildItems(tx, ctx, input.items, () => deps.ids.next(), { keepFromStock: false });
    const total = items.reduce((a, it) => a + it.qty * it.priceCents, 0);
    const partial = input.paidNowCents !== undefined && input.paidNowCents < total;
    await insertSale(tx, ctx, { id, on: input.on, channelId: input.channelId, customerId: input.customerId ?? null, note: input.note?.trim() ?? '', tracksPayments: partial });
    await insertLineItems(tx, ctx, items.map((it) => ({ ...it, parentKind: 'sale', parentId: id })));
    if (partial && input.paidNowCents! > 0) await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'sale', parentId: id, on: input.on, amountCents: input.paidNowCents!, note: 'Pago al vender' }]);
    await takeFromShelf(deps, tx, ctx, id, items.map((it) => lineItemData({ ...it, parentKind: 'sale', parentId: id, workspaceId: ctx.workspaceId, createdAt: new Date(), updatedAt: new Date() })), input.on, input.note?.trim() ?? '');
    return id;
  });
  return saleDetail(deps, deps.db, ctx, id);
}

export async function updateSaleUc(deps: Deps, ctx: Ctx, id: string, input: SalePatch) {
  await transaction(deps.db, async (tx) => {
    if (!(await getSale(tx, ctx, id, { forUpdate: true }))) throw notFound('sale');
    await assertRefs(tx, ctx, input.channelId, input.customerId);
    await updateSale(tx, ctx, id, {
      ...(input.on ? { on: input.on } : {}), ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}), ...(input.note !== undefined ? { note: input.note.trim() } : {}),
    });
  });
  return saleDetail(deps, deps.db, ctx, id);
}

/** Net pieces that are out because of this sale (its "sale" and "return" movements). */
async function outBySale(tx: Executor, ctx: Ctx, s: SaleRow) {
  const net = new Map<string, number>();
  for (const m of await stockMovementsByRef(tx, ctx, s.id)) net.set(m.productId, (net.get(m.productId) ?? 0) + m.qty);
  return net;
}

export async function deleteSale(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    const s = await getSale(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('sale');
    const out = await outBySale(tx, ctx, s);
    await insertStockMovements(tx, ctx, [...out].filter(([, n]) => n < 0).map(([productId, n]) => ({ id: deps.ids.next(), productId, on: deps.clock.today(), kind: 'return', qty: -n, note: 'Venta eliminada', refId: id })));
    await setSaleDeleted(tx, ctx, id, deps.clock.now());
  });
}

export async function restoreSale(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    const s = await getSale(tx, ctx, id, { deleted: true, forUpdate: true });
    if (!s) throw notFound('sale');
    const ch = await childrenOf(tx, ctx, 'sale', [id]);
    await setSaleDeleted(tx, ctx, id, null);
    const hadShelf = (await stockMovementsByRef(tx, ctx, id)).some((m) => m.kind === 'sale');
    if (hadShelf && !s.return?.restock) await takeFromShelf(deps, tx, ctx, id, ch.items(id).map(lineItemData), deps.clock.today(), 'Venta restaurada');
  });
  return saleDetail(deps, deps.db, ctx, id);
}

async function owedNow(tx: Executor, ctx: Ctx, s: SaleRow) {
  const channels = await listChannels(tx, ctx);
  const ch = await childrenOf(tx, ctx, 'sale', [s.id]);
  const d = saleData(s, ch.items(s.id), ch.payments(s.id), commissionOf(channels, s.channelId));
  return { owed: cents(saleOwed(d)), paid: cents(salePaid(d)) };
}

export async function recordSalePayment(deps: Deps, ctx: Ctx, id: string, input: PaymentInput) {
  await transaction(deps.db, async (tx) => {
    const s = await getSale(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('sale');
    const { owed } = await owedNow(tx, ctx, s);
    if (input.amountCents > owed) throw new BusinessError('PAYMENT_EXCEEDS_BALANCE', { balanceCents: owed });
    await insertPayments(tx, ctx, [{ id: deps.ids.next(), parentKind: 'sale', parentId: id, on: input.on, amountCents: input.amountCents, note: input.note?.trim() || 'Abono' }]);
  });
  return saleDetail(deps, deps.db, ctx, id);
}

export async function deleteSalePayment(deps: Deps, ctx: Ctx, id: string, paymentId: string) {
  await transaction(deps.db, async (tx) => {
    if (!(await getSale(tx, ctx, id, { forUpdate: true }))) throw notFound('sale');
    if (!(await deletePayment(tx, ctx, 'sale', id, paymentId))) throw notFound('payment');
  });
  return saleDetail(deps, deps.db, ctx, id);
}

/** Return: income 0; with restock the pieces go back and cost is 0; otherwise the cost is lost (docs/04 §6). */
export async function returnSale(deps: Deps, ctx: Ctx, id: string, input: ReturnSaleInput) {
  await transaction(deps.db, async (tx) => {
    const s = await getSale(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('sale');
    if (s.return) throw new BusinessError('SALE_ALREADY_RETURNED');
    const { paid } = await owedNow(tx, ctx, s);
    const refund = input.refundCents ?? 0;
    if (refund > paid) throw new BusinessError('REFUND_EXCEEDS_PAID', { paidCents: paid });
    await updateSale(tx, ctx, id, { return: { on: input.on, restock: input.restock, refundCents: refund, note: input.note?.trim() ?? '' } });
    if (input.restock) {
      const products = await listProducts(tx, ctx);
      const tracks = new Map(products.map((p) => [p.id, p.tracksStock]));
      const ch = await childrenOf(tx, ctx, 'sale', [id]);
      await insertStockMovements(tx, ctx, Object.entries(needOf(ch.items(id).map(lineItemData))).filter(([pid, n]) => tracks.get(pid) && n > 0)
        .map(([productId, n]) => ({ id: deps.ids.next(), productId, on: input.on, kind: 'return', qty: n, note: input.note?.trim() || 'Devolución', refId: id })));
    }
  });
  return saleDetail(deps, deps.db, ctx, id);
}
