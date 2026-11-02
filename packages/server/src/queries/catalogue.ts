// Productos: pieces and collections with their cost and price computed by core (the server is the authority).
import { BusinessError, type Catalogue, type Collection, type Product } from '@app/contract';
import { costCollection, costProduct, fromCents, minutesToHours } from '@app/core';
import { collectionRepo, productRepo, type Ctx, type Executor } from '@app/db';
import { loadCostingContext } from './costing';

export const fileUrl = (fileId: string) => `/api/v1/files/${fileId}`;

export async function listCatalogue(ex: Executor, ctx: Ctx): Promise<Catalogue> {
  const [{ core, dto }, products, lines, collections, parts] = await Promise.all([
    loadCostingContext(ex, ctx),
    productRepo.list(ex, ctx),
    productRepo.lines(ex, ctx),
    collectionRepo.list(ex, ctx),
    collectionRepo.parts(ex, ctx),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const printerName = new Map(dto.printers.map((p) => [p.id, p.name]));
  const collectionsOf = (productId: string) =>
    collections.filter((c) => parts.some((r) => r.collectionId === c.id && r.productId === productId)).map((c) => ({ id: c.id, name: c.name }));

  const items: Product[] = products.map((p) => {
    const filaments = lines.filaments.filter((l) => l.productId === p.id).map((l) => ({ filamentId: l.filamentId, grams: l.grams }));
    const supplies = lines.supplies.filter((l) => l.productId === p.id).map((l) => ({ supplyId: l.supplyId, qty: l.qty }));
    const costing = costProduct(
      { mode: p.mode, price: fromCents(p.priceCents), marginPct: p.marginPct, printerId: p.printerId, hours: minutesToHours(p.printMinutes), extras: fromCents(p.extrasCents), filaments, supplies },
      core,
    );
    const parent = p.parentId ? byId.get(p.parentId) : undefined;
    return {
      id: p.id,
      name: p.name,
      parentId: parent ? p.parentId : null,
      parentName: parent?.name ?? null,
      mode: p.mode,
      priceCents: p.priceCents,
      marginPct: p.marginPct,
      printerId: p.printerId,
      printerName: p.printerId ? (printerName.get(p.printerId) ?? null) : null,
      printMinutes: p.printMinutes,
      batchSize: p.batchSize,
      extrasCents: p.extrasCents,
      tracksStock: p.tracksStock,
      tags: p.tags,
      note: p.note,
      spec: p.spec ?? null,
      photoUrl: p.photoFileId ? fileUrl(p.photoFileId) : null,
      filaments,
      supplies,
      costing,
      collections: collectionsOf(p.id),
    };
  });

  const costed = Object.fromEntries(items.map((p) => [p.id, { listPrice: p.costing.listPrice, total: p.costing.total }]));
  const productName = new Map(items.map((p) => [p.id, p.name]));
  const cols: Collection[] = collections.map((c) => {
    const cc = costCollection(
      { price: c.priceCents == null ? null : fromCents(c.priceCents), extras: fromCents(c.extrasCents), parts: parts.filter((r) => r.collectionId === c.id).map((r) => ({ productId: r.productId, qty: r.qty })) },
      costed,
      core.settings.minMarginPct,
    );
    return {
      id: c.id,
      name: c.name,
      priceCents: c.priceCents,
      extrasCents: c.extrasCents,
      tags: c.tags,
      note: c.note,
      parts: cc.parts.map((x) => ({ ...x, productName: productName.get(x.productId) ?? '' })),
      costing: { loose: cc.loose, price: cc.price, pieces: cc.pieces, extras: cc.extras, cost: cc.cost, profit: cc.profit, pieceCount: cc.pieceCount, floor: cc.floor },
    };
  });
  return { products: items, collections: cols };
}

export async function getProduct(ex: Executor, ctx: Ctx, id: string): Promise<Product> {
  const p = (await listCatalogue(ex, ctx)).products.find((x) => x.id === id);
  if (!p) throw new BusinessError('PRODUCT_NOT_FOUND');
  return p;
}

export async function getCollection(ex: Executor, ctx: Ctx, id: string): Promise<Collection> {
  const c = (await listCatalogue(ex, ctx)).collections.find((x) => x.id === id);
  if (!c) throw new BusinessError('COLLECTION_NOT_FOUND');
  return c;
}
