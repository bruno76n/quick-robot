// Existencias (docs/04 §5, docs/06 §11, docs/12 §8 › Producción y existencias).
import { BusinessError, type AdjustStockInput, type EnableStockInput } from '@app/contract';
import { buildableSets, soldCounts, stockStatus, variantDisplayName } from '@app/core';
import {
  getProduct, insertStockMovements, listChannels, listCollections, listCustomers, listOrders, listProducts, listSales, listStockMovements, transaction, updateProduct,
  type Ctx, type Executor,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { costOf, loadCostingContext, priceOf, supplyIdsOf } from '../../views/costing';
import { photoUrl } from '../products';
import { ACTIVE, childrenOf, commissionOf, loadStock, saleData, type StockState } from './common';

const level = (st: StockState, id: string) => {
  const physical = st.physical.get(id) ?? 0;
  const reserved = Math.min(physical, st.reserved(id));
  return { physical, reserved, free: Math.max(0, physical - reserved), status: stockStatus(physical, reserved) };
};

/** Stock of some pieces, for product tiles and the checks of phase 2 (PRODUCT_HAS_STOCK…). */
export async function stockOf(ex: Executor, ctx: Ctx, productIds: readonly string[]) {
  const st = await loadStock(ex, ctx);
  return new Map(productIds.map((id) => [id, level(st, id)]));
}

/** Folios of active orders that use a piece (PRODUCT_IN_ACTIVE_ORDERS). */
export async function activeOrderFolios(ex: Executor, ctx: Ctx, productId: string) {
  const orders = await listOrders(ex, ctx, { statuses: ACTIVE });
  const ch = await childrenOf(ex, ctx, 'order', orders.map((o) => o.id));
  return orders.filter((o) => ch.items(o.id).some((it) => it.productId === productId || (it.parts ?? []).some((p) => p.productId === productId))).map((o) => o.number);
}

/** Pieces sold (also inside sets) and sets sold; returned sales do not count. */
export async function soldOf(ex: Executor, ctx: Ctx) {
  const sales = await listSales(ex, ctx);
  const ch = await childrenOf(ex, ctx, 'sale', sales.map((s) => s.id));
  const channels = await listChannels(ex, ctx);
  return soldCounts(sales.map((s) => saleData(s, ch.items(s.id), ch.payments(s.id), commissionOf(channels, s.channelId))));
}

export async function stockList(deps: Deps, ex: Executor, ctx: Ctx, q?: string) {
  const products = await listProducts(ex, ctx);
  const st = await loadStock(ex, ctx, products);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const needle = q?.trim().toLocaleLowerCase('es');
  const tracked = products.filter((p) => p.tracksStock && (!needle || p.name.toLocaleLowerCase('es').includes(needle)));
  const items = await Promise.all(tracked.map(async (p) => {
    const total = costOf(p, c).total;
    return { productId: p.id, name: p.name, photoUrl: await photoUrl(deps, ctx, p.photoFileId), hexes: p.filaments.map((f) => c.filaments.get(f.filamentId)?.hex ?? '#c9c9d1'), listCents: Math.round(priceOf(p, c, total) * 100), costCents: Math.round(total * 100), ...level(st, p.id) };
  }));
  const cols = await listCollections(ex, ctx);
  return {
    items,
    totals: { physical: items.reduce((a, x) => a + x.physical, 0), free: items.reduce((a, x) => a + x.free, 0), reserved: items.reduce((a, x) => a + x.reserved, 0) },
    untracked: products.filter((p) => !p.tracksStock).map((p) => ({ id: p.id, name: p.name })),
    sets: cols.map((col) => ({ id: col.id, name: col.name, buildableSets: buildableSets(col.parts, (id) => (st.tracks.get(id) ? st.free(id) : null)) })),
  };
}

export async function stockDetail(deps: Deps, ex: Executor, ctx: Ctx, productId: string) {
  const p = await getProduct(ex, ctx, productId);
  if (!p) throw notFound('product');
  const st = await loadStock(ex, ctx);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf([p]));
  const total = costOf(p, c).total;
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((x) => [x.id, x.name]));
  const orders = await listOrders(ex, ctx, { ids: st.orders.map((o) => o.id) });
  const reservedBy = st.orders.map((o) => ({ o, n: st.reserved(productId) - st.reserved(productId, o.id) })).filter((x) => x.n > 0)
    .map(({ o, n }) => ({ orderId: o.id, number: o.number, status: o.status, customer: customers.get(orders.find((r) => r.id === o.id)?.customerId ?? '') ?? '', qty: n }));
  return {
    productId: p.id, name: p.name, tracksStock: p.tracksStock, photoUrl: await photoUrl(deps, ctx, p.photoFileId),
    listCents: Math.round(priceOf(p, c, total) * 100), costCents: Math.round(total * 100), ...level(st, p.id), reservedBy,
    movements: (await listStockMovements(ex, ctx, productId)).map((m) => ({ id: m.id, on: m.on, kind: m.kind, qty: m.qty, note: m.note, refId: m.refId })),
  };
}

export async function enableStockTracking(deps: Deps, ctx: Ctx, productId: string, input: EnableStockInput) {
  await transaction(deps.db, async (tx) => {
    const p = await getProduct(tx, ctx, productId, { forUpdate: true });
    if (!p) throw notFound('product');
    if (!p.tracksStock) await updateProduct(tx, ctx, productId, { tracksStock: true });
    if (input.initialCount > 0) await insertStockMovements(tx, ctx, [{ id: deps.ids.next(), productId, on: deps.clock.today(), kind: 'initial', qty: input.initialCount, note: '' }]);
  });
  return stockDetail(deps, deps.db, ctx, productId);
}

/** Count (the real total) or a delta; never below what is reserved for orders (docs/06 §11). */
export async function adjustStock(deps: Deps, ctx: Ctx, productId: string, input: AdjustStockInput) {
  await transaction(deps.db, async (tx) => {
    const p = await getProduct(tx, ctx, productId, { forUpdate: true });
    if (!p || !p.tracksStock) throw notFound('product');
    const st = await loadStock(tx, ctx);
    const { physical, reserved, free } = level(st, productId);
    const delta = input.mode === 'count' ? input.value - physical : input.value;
    if (input.mode === 'count' && input.value < reserved) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'value', rule: 'too_small', params: { min: reserved } }] });
    if (delta === 0) throw new BusinessError('COUNT_UNCHANGED');
    if (delta < 0 && -delta > free) {
      const parent = p.parentId ? await getProduct(tx, ctx, p.parentId) : undefined;
      const name = variantDisplayName(p.name, parent?.name, p.variantLabel);
      throw new BusinessError('INSUFFICIENT_STOCK', { items: [{ productId, name, requested: -delta, free }], productId, name, requested: -delta, free });
    }
    await insertStockMovements(tx, ctx, [{ id: deps.ids.next(), productId, on: deps.clock.today(), kind: 'adjustment', qty: delta, note: input.note?.trim() ?? '' }]);
  });
  return stockDetail(deps, deps.db, ctx, productId);
}
