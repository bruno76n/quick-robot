// Pieces and collections (docs/04 §2–3, docs/06 §3, docs/12 §5). The server recalculates every cost and price.
import { BusinessError, type CollectionDetail, type CollectionListItem, type ProductDetail, type ProductListItem, type SaveCollectionInput, type SaveProductInput } from '@app/contract';
import { tidyName } from '@app/core';
import {
  getCollection, getFile, getFilament, getPrinter, getProduct, getSupply, insertCollection, insertProduct, listCollections, listPrinters, listProducts,
  replaceCollectionParts, replaceProductParts, setCollectionDeleted, setProductDeleted, transaction, updateCollection, updateProduct,
  type Ctx, type Executor, type ProductFull,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { collectionDetailView, collectionListView, loadCostingContext, productDetailView, productListView, supplyIdsOf, type ProductExtras } from '../views/costing';

/** Stock and order checks live in phase 3; they plug in here (decision 2.3). */
export interface ProductHooks {
  stock(tx: Executor, ctx: Ctx, productIds: readonly string[]): Promise<Map<string, { physical: number; reserved: number; free: number }>>;
  activeOrderFolios(tx: Executor, ctx: Ctx, productId: string): Promise<number[]>;
  /** Pieces sold (also inside sets) and sets sold, from phase 3. */
  sold(tx: Executor, ctx: Ctx): Promise<{ products: Map<string, number>; collections: Map<string, number> }>;
}
export const productHooks: ProductHooks = { stock: async () => new Map(), activeOrderFolios: async () => [], sold: async () => ({ products: new Map(), collections: new Map() }) };
const NO_STOCK = { physical: 0, reserved: 0, free: 0 };

export async function photoUrl(_deps: Deps, _ctx: Ctx, fileId: string | null): Promise<string | null> {
  return fileId ? `/api/v1/files/${fileId}` : null;
}

async function extrasFor(deps: Deps, ex: Executor, ctx: Ctx, products: readonly ProductFull[]) {
  const all = await listProducts(ex, ctx);
  const names = new Map(all.map((p) => [p.id, p.name]));
  const printers = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const cols = await listCollections(ex, ctx);
  const stock = await productHooks.stock(ex, ctx, products.map((p) => p.id));
  const sold = await productHooks.sold(ex, ctx);
  return async (p: ProductFull): Promise<ProductExtras> => {
    const st = stock.get(p.id) ?? NO_STOCK;
    return {
      photoUrl: await photoUrl(deps, ctx, p.photoFileId), free: st.free, physical: st.physical, reserved: st.reserved, sold: sold.products.get(p.id) ?? 0,
      printerName: p.printerId ? printers.get(p.printerId) ?? null : null, parentName: p.parentId ? names.get(p.parentId) ?? null : null,
      collections: cols.filter((c) => c.parts.some((x) => x.productId === p.id)).map((c) => ({ id: c.id, name: c.name })),
    };
  };
}

export async function productList(deps: Deps, ex: Executor, ctx: Ctx, filter: 'all' | 'technical' | 'variant' = 'all', q?: string): Promise<ProductListItem[]> {
  const products = await listProducts(ex, ctx);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const extras = await extrasFor(deps, ex, ctx, products);
  const items = await Promise.all(products.map(async (p) => productListView(p, c, await extras(p))));
  const needle = q?.trim().toLocaleLowerCase('es');
  return items.filter((p) => (filter === 'technical' ? p.technical : filter === 'variant' ? Boolean(p.parentId) : true) && (!needle || p.name.toLocaleLowerCase('es').includes(needle) || p.tags.some((t) => t.toLocaleLowerCase('es').includes(needle))));
}

export async function productDetail(deps: Deps, ex: Executor, ctx: Ctx, id: string): Promise<ProductDetail> {
  const p = await getProduct(ex, ctx, id);
  if (!p) throw notFound('product');
  const c = await loadCostingContext(ex, ctx, supplyIdsOf([p]));
  return productDetailView(p, c, await (await extrasFor(deps, ex, ctx, [p]))(p));
}

async function checkRefs(tx: Executor, ctx: Ctx, input: SaveProductInput) {
  if (input.printerId && !(await getPrinter(tx, ctx, input.printerId))) throw notFound('printer');
  for (const f of input.filaments) if (!(await getFilament(tx, ctx, f.filamentId))) throw notFound('filament');
  for (const s of input.supplies) if (!(await getSupply(tx, ctx, s.supplyId))) throw notFound('supply');
  if (input.photoFileId) {
    const file = await getFile(tx, ctx, input.photoFileId);
    if (!file || file.kind !== 'product_photo') throw notFound('file');
  }
  if (input.mode === 'value' && !(input.priceCents && input.priceCents > 0)) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'price', rule: 'required' }] });
}

const productRow = (input: SaveProductInput) => ({
  name: tidyName(input.name), tags: [...new Set(input.tags.map(tidyName))], mode: input.mode, priceCents: input.priceCents ?? 0, marginPct: input.marginPct ?? null,
  printerId: input.printerId ?? null, hours: Math.round(input.hours * 100) / 100, batchSize: input.batchSize, extrasCents: input.extrasCents, tracksStock: input.tracksStock,
  note: input.note.trim(), spec: input.spec ?? null, photoFileId: input.photoFileId ?? null,
});

async function writeParts(deps: Deps, tx: Executor, ctx: Ctx, id: string, input: SaveProductInput) {
  const fil = input.filaments.filter((f) => f.grams > 0).map((f) => ({ id: deps.ids.next(), filamentId: f.filamentId, grams: f.grams }));
  const sup = input.supplies.filter((s) => s.qty > 0).map((s) => ({ id: deps.ids.next(), supplyId: s.supplyId, qty: s.qty }));
  await replaceProductParts(tx, ctx, id, fil, sup);
}

/** saveProduct · POST /products and PUT /products/:id. Costs are never taken from the client. */
export async function saveProduct(deps: Deps, ctx: Ctx, input: SaveProductInput, id?: string): Promise<ProductDetail> {
  return transaction(deps.db, async (tx) => {
    await checkRefs(tx, ctx, input);
    let productId = id;
    if (id) {
      const before = await getProduct(tx, ctx, id, { forUpdate: true });
      if (!before) throw notFound('product');
      if (before.tracksStock && !input.tracksStock) {
        const onHand = (await productHooks.stock(tx, ctx, [id])).get(id)?.physical ?? 0;
        if (onHand > 0) throw new BusinessError('STOCK_TRACKING_HAS_STOCK', { onHand });
      }
      await updateProduct(tx, ctx, id, productRow(input));
    } else {
      productId = (await insertProduct(tx, ctx, { id: deps.ids.next(), parentId: null, ...productRow(input) })).id;
    }
    await writeParts(deps, tx, ctx, productId!, input);
    return productDetail(deps, tx, ctx, productId!);
  });
}

/** A copy with parent_id = the original (docs/06 §3). */
export async function saveProductAsVariant(deps: Deps, ctx: Ctx, parentId: string, input: SaveProductInput): Promise<ProductDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await getProduct(tx, ctx, parentId))) throw notFound('product');
    await checkRefs(tx, ctx, input);
    const p = await insertProduct(tx, ctx, { id: deps.ids.next(), parentId, ...productRow(input) });
    await writeParts(deps, tx, ctx, p.id, input);
    return productDetail(deps, tx, ctx, p.id);
  });
}

export async function deleteProduct(deps: Deps, ctx: Ctx, id: string): Promise<void> {
  await transaction(deps.db, async (tx) => {
    if (!(await getProduct(tx, ctx, id, { forUpdate: true }))) throw notFound('product');
    const folios = await productHooks.activeOrderFolios(tx, ctx, id);
    if (folios.length) throw new BusinessError('PRODUCT_IN_ACTIVE_ORDERS', { count: folios.length, folios: folios.map((f) => `#${f}`) });
    const onHand = (await productHooks.stock(tx, ctx, [id])).get(id)?.physical ?? 0;
    if (onHand > 0) throw new BusinessError('PRODUCT_HAS_STOCK', { onHand });
    await setProductDeleted(tx, ctx, id, deps.clock.now());
  });
}

export async function restoreProduct(deps: Deps, ctx: Ctx, id: string): Promise<ProductDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await getProduct(tx, ctx, id, { deleted: true }))) throw notFound('product');
    await setProductDeleted(tx, ctx, id, null);
    return productDetail(deps, tx, ctx, id);
  });
}

/** Sets that can be built today with the free pieces (phase 3 fills the stock). */
export function buildable(parts: readonly { productId: string; qty: number }[], stock: Map<string, { free: number }>, tracks: Map<string, boolean>): number {
  if (!parts.length) return 0;
  return Math.min(...parts.map((p) => (tracks.get(p.productId) ? Math.floor((stock.get(p.productId)?.free ?? 0) / Math.max(1, p.qty)) : 0)));
}

async function collectionContext(ex: Executor, ctx: Ctx) {
  const products = await listProducts(ex, ctx);
  const map = new Map<string, ProductFull>(products.map((p) => [p.id, p]));
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const stock = await productHooks.stock(ex, ctx, products.map((p) => p.id));
  const tracks = new Map(products.map((p) => [p.id, p.tracksStock]));
  const sold = (await productHooks.sold(ex, ctx)).collections;
  return { map, c, stock, tracks, sold };
}

export async function collectionList(_deps: Deps, ex: Executor, ctx: Ctx, q?: string): Promise<CollectionListItem[]> {
  const { map, c, stock, tracks, sold } = await collectionContext(ex, ctx);
  const needle = q?.trim().toLocaleLowerCase('es');
  return (await listCollections(ex, ctx))
    .filter((col) => !needle || col.name.toLocaleLowerCase('es').includes(needle))
    .map((col) => collectionListView(col, map, c, buildable(col.parts.filter((p) => map.has(p.productId)), stock, tracks), sold.get(col.id) ?? 0));
}

export async function collectionDetail(_deps: Deps, ex: Executor, ctx: Ctx, id: string): Promise<CollectionDetail> {
  const col = await getCollection(ex, ctx, id);
  if (!col) throw notFound('collection');
  const { map, c, stock, tracks } = await collectionContext(ex, ctx);
  return collectionDetailView(col, map, c, buildable(col.parts.filter((p) => map.has(p.productId)), stock, tracks));
}

export async function saveCollection(deps: Deps, ctx: Ctx, input: SaveCollectionInput, id?: string): Promise<CollectionDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await listProducts(tx, ctx)).length) throw new BusinessError('NO_PRODUCTS');
    if (!input.parts.length) throw new BusinessError('COLLECTION_EMPTY');
    for (const p of input.parts) if (!(await getProduct(tx, ctx, p.productId))) throw notFound('product');
    const row = { name: tidyName(input.name), tags: [...new Set(input.tags.map(tidyName))], extrasCents: input.extrasCents, priceCents: input.priceCents && input.priceCents > 0 ? input.priceCents : null, note: input.note.trim() };
    let colId = id;
    if (id) {
      if (!(await updateCollection(tx, ctx, id, row))) throw notFound('collection');
    } else colId = (await insertCollection(tx, ctx, { id: deps.ids.next(), ...row })).id;
    await replaceCollectionParts(tx, ctx, colId!, input.parts.map((p) => ({ id: deps.ids.next(), productId: p.productId, qty: p.qty })));
    return collectionDetail(deps, tx, ctx, colId!);
  });
}

export async function deleteCollection(deps: Deps, ctx: Ctx, id: string): Promise<void> {
  await transaction(deps.db, async (tx) => {
    if (!(await setCollectionDeleted(tx, ctx, id, deps.clock.now()))) throw notFound('collection');
  });
}

export async function restoreCollection(deps: Deps, ctx: Ctx, id: string): Promise<CollectionDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await getCollection(tx, ctx, id, { deleted: true }))) throw notFound('collection');
    await setCollectionDeleted(tx, ctx, id, null);
    return collectionDetail(deps, tx, ctx, id);
  });
}
