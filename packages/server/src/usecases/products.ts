// Pieces and collections (docs/04 §2–3, docs/06 §3, docs/12 §5). The server recalculates every cost and price.
import {
  BusinessError, type CollectionDetail, type CollectionListItem, type ProductDetail, type ProductFamilyFilter, type ProductFamilyPage, type ProductListItem,
  type ProductVariantItem, type SaveCollectionInput, type SaveProductAsVariantInput, type SaveProductInput,
} from '@app/contract';
import { TECHNICAL_MATERIALS, tidyName } from '@app/core';
import {
  countLiveVariants, getCollection, getFile, getFilament, getPrinter, getProduct, getSupply, insertCollection, insertProduct, listCollections, listPrinters, listProductFamilies, listProducts,
  replaceCollectionParts, replaceProductParts, setCollectionDeleted, setProductDeleted, transaction, updateCollection, updateProduct,
  type Ctx, type Executor, type ProductFull,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { collectionDetailView, collectionListView, loadCostingContext, materialOf, productDetailView, productListView, supplyIdsOf, type CostingContext, type ProductExtras } from '../views/costing';

/** Stock and order checks live in phase 3; they plug in here (decision 2.3). */
export interface ProductHooks {
  stock(tx: Executor, ctx: Ctx, productIds: readonly string[]): Promise<Map<string, { physical: number; reserved: number; free: number }>>;
  activeOrderFolios(tx: Executor, ctx: Ctx, productId: string): Promise<number[]>;
  /** Pieces sold (also inside sets) and sets sold, from phase 3. */
  sold(tx: Executor, ctx: Ctx, productIds?: readonly string[]): Promise<{ products: Map<string, number>; collections: Map<string, number> }>;
}
export const productHooks: ProductHooks = { stock: async () => new Map(), activeOrderFolios: async () => [], sold: async () => ({ products: new Map(), collections: new Map() }) };
const NO_STOCK = { physical: 0, reserved: 0, free: 0 };

export async function photoUrl(_deps: Deps, _ctx: Ctx, fileId: string | null): Promise<string | null> {
  return fileId ? `/api/v1/files/${fileId}` : null;
}

/** Names of the originals of some pieces (for displayName), without loading the whole catalog. */
async function parentNamesOf(ex: Executor, ctx: Ctx, products: readonly ProductFull[]): Promise<Map<string, string>> {
  const names = new Map(products.map((p) => [p.id, p.name]));
  const missing = [...new Set(products.flatMap((p) => (p.parentId && !names.has(p.parentId) ? [p.parentId] : [])))];
  if (missing.length) for (const p of await listProducts(ex, ctx, { ids: missing })) names.set(p.id, p.name);
  return names;
}

async function extrasFor(deps: Deps, ex: Executor, ctx: Ctx, products: readonly ProductFull[]) {
  const names = await parentNamesOf(ex, ctx, products);
  const printers = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const cols = await listCollections(ex, ctx);
  const stock = await productHooks.stock(ex, ctx, products.map((p) => p.id));
  // Only the pieces asked for (a page of families, or one piece): never a scan of every sale for nothing (R13).
  const sold = await productHooks.sold(ex, ctx, products.map((p) => p.id));
  return async (p: ProductFull): Promise<ProductExtras> => {
    const st = stock.get(p.id) ?? NO_STOCK;
    return {
      photoUrl: await photoUrl(deps, ctx, p.photoFileId), free: st.free, physical: st.physical, reserved: st.reserved, sold: sold.products.get(p.id) ?? 0,
      printerName: p.printerId ? printers.get(p.printerId) ?? null : null, parentName: p.parentId ? names.get(p.parentId) ?? null : null,
      collections: cols.filter((c) => c.parts.some((x) => x.productId === p.id)).map((c) => ({ id: c.id, name: c.name })),
    };
  };
}

/** Every live piece, ordered by family (the original first, then its variants): GET /products/options (D-1). */
export async function productOptions(deps: Deps, ex: Executor, ctx: Ctx): Promise<ProductListItem[]> {
  const products = await listProducts(ex, ctx);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const extras = await extrasFor(deps, ex, ctx, products);
  const alive = new Set(products.map((p) => p.id));
  const rootOf = (p: ProductFull) => (p.parentId && alive.has(p.parentId) ? p.parentId : p.id);
  const order = new Map(products.filter((p) => rootOf(p) === p.id).map((p, i) => [p.id, i]));
  const sorted = products.map((p, i) => ({ p, i })).sort((a, b) => order.get(rootOf(a.p))! - order.get(rootOf(b.p))! || Number(rootOf(a.p) !== a.p.id) - Number(rootOf(b.p) !== b.p.id) || a.i - b.i);
  return Promise.all(sorted.map(async ({ p }) => productListView(p, c, await extras(p))));
}

const matches = (p: ProductFull, needle: string) => [p.name, p.variantLabel ?? '', ...p.tags].some((x) => x.toLocaleLowerCase('es').includes(needle));

/** GET /products: one page of families with their variants and the counts of the chips (docs/12 §5). */
export async function productFamilies(deps: Deps, ex: Executor, ctx: Ctx, opts: { q?: string | undefined; filter?: ProductFamilyFilter | undefined; tag?: string | undefined; page: number; pageSize: number }): Promise<ProductFamilyPage> {
  const pg = await listProductFamilies(ex, ctx, { ...opts, technicalPrefixes: TECHNICAL_MATERIALS });
  const members = [...pg.roots, ...pg.variants];
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(members));
  const extras = await extrasFor(deps, ex, ctx, members);
  const needle = opts.q?.trim().toLocaleLowerCase('es') ?? '';
  const items = await Promise.all(pg.roots.map(async (r) => {
    const own = pg.variants.filter((v) => v.parentId === r.id);
    const variants = await Promise.all(own.map(async (v) => variantItem(v, productListView(v, c, await extras(v)), c)));
    const base = productListView(r, c, await extras(r));
    return {
      ...base, technical: base.technical || variants.some((v) => v.technical), variantCount: own.length, variants,
      matchedByVariant: Boolean(needle) && !matches(r, needle) && own.some((v) => matches(v, needle)),
    };
  }));
  return { items, page: opts.page, pageSize: opts.pageSize, total: pg.total, counts: pg.counts };
}

function variantItem(v: ProductFull, l: ProductListItem, c: CostingContext): ProductVariantItem {
  return {
    id: l.id, name: l.name, label: v.variantLabel ?? l.name, displayName: l.displayName, tags: l.tags, photoUrl: l.photoUrl, costCents: l.costCents, listCents: l.listCents,
    floorCents: l.floorCents, tracksStock: l.tracksStock, free: l.free, physical: l.physical, reserved: l.reserved, soldCount: l.sold, material: materialOf(v, c),
    hexes: l.hexes, technical: l.technical, printerId: l.printerId, printerName: l.printerName, mode: l.mode, hours: l.hours,
  };
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
      await updateProduct(tx, ctx, id, { ...productRow(input), ...(before.parentId && input.variantLabel ? { variantLabel: tidyName(input.variantLabel) } : {}) });
    } else {
      productId = (await insertProduct(tx, ctx, { id: deps.ids.next(), parentId: null, ...productRow(input) })).id;
    }
    await writeParts(deps, tx, ctx, productId!, input);
    return productDetail(deps, tx, ctx, productId!);
  });
}

/**
 * A copy with parent_id = the root original (docs/06 §3, one level): from a variant, it goes up to its original.
 * The label is required (mejoras/ronda-2.md §3.1).
 */
export async function saveProductAsVariant(deps: Deps, ctx: Ctx, sourceId: string, input: SaveProductAsVariantInput): Promise<ProductDetail> {
  return transaction(deps.db, async (tx) => {
    const source = await getProduct(tx, ctx, sourceId);
    if (!source) throw notFound('product');
    const parent = source.parentId ? await getProduct(tx, ctx, source.parentId) : undefined;
    const rootId = parent ? parent.id : source.id;
    await checkRefs(tx, ctx, input);
    const p = await insertProduct(tx, ctx, { id: deps.ids.next(), parentId: rootId, ...productRow(input), variantLabel: tidyName(input.variantLabel) });
    await writeParts(deps, tx, ctx, p.id, input);
    return productDetail(deps, tx, ctx, p.id);
  });
}

export async function deleteProduct(deps: Deps, ctx: Ctx, id: string): Promise<void> {
  await transaction(deps.db, async (tx) => {
    if (!(await getProduct(tx, ctx, id, { forUpdate: true }))) throw notFound('product');
    const variants = await countLiveVariants(tx, ctx, id);
    if (variants > 0) throw new BusinessError('PRODUCT_HAS_VARIANTS', { count: variants });
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
