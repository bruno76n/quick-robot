// Productos (docs/06 §3): saveProduct, saveProductAsVariant, deleteProduct (+ restore), saveCollection,
// deleteCollection (+ restore). Costs are never stored: they are computed on read with core.
import { BusinessError, CollectionInput, ProductInput, type Collection, type Product, type ProductParsed } from '@app/contract';
import { mergeParts } from '@app/core';
import { collectionRepo, filamentRepo, printerRepo, productRepo, supplyRepo, type Ctx, type Executor, type ProductData, type ProductLines } from '@app/db';
import { getCollection, getProduct } from '../queries/catalogue';
import type { UseCaseDeps } from './deps';

async function validateProduct(tx: Executor, ctx: Ctx, input: ProductParsed, selfId?: string): Promise<{ data: ProductData; lines: ProductLines }> {
  const filaments = input.filaments.filter((f) => f.filamentId);
  if (!filaments.some((f) => f.grams > 0)) throw new BusinessError('PRODUCT_NEEDS_FILAMENT');
  if (input.mode === 'value' && input.priceCents <= 0) throw new BusinessError('PRODUCT_NEEDS_PRICE');
  for (const f of filaments) if (!(await filamentRepo.get(tx, ctx, f.filamentId))) throw new BusinessError('FILAMENT_NOT_FOUND');
  const supplies = input.supplies.filter((s) => s.supplyId && s.qty > 0);
  for (const s of supplies) if (!(await supplyRepo.get(tx, ctx, s.supplyId))) throw new BusinessError('SUPPLY_NOT_FOUND');
  if (input.printerId && !(await printerRepo.get(tx, ctx, input.printerId))) throw new BusinessError('PRINTER_NOT_FOUND');
  if (input.parentId && (input.parentId === selfId || !(await productRepo.get(tx, ctx, input.parentId)))) throw new BusinessError('PRODUCT_NOT_FOUND', 'Parent not found');
  const spec = input.spec && Object.values(input.spec).some((v) => v && String(v).trim()) ? input.spec : null;
  return {
    data: {
      name: input.name,
      parentId: input.parentId,
      mode: input.mode,
      priceCents: input.mode === 'value' ? input.priceCents : 0,
      marginPct: input.marginPct,
      printerId: input.printerId,
      printMinutes: input.printMinutes,
      batchSize: input.batchSize,
      extrasCents: input.extrasCents,
      tracksStock: input.tracksStock,
      tags: [...new Set(input.tags)],
      note: input.note,
      spec,
      photoFileId: null,
    },
    lines: { filaments, supplies },
  };
}

/** Create (id = null) or update a piece. The photo is kept (it changes through setProductPhoto). */
export async function saveProduct(deps: UseCaseDeps, ctx: Ctx, id: string | null, raw: unknown): Promise<Product> {
  const input = ProductInput.parse(raw);
  if (!id) await deps.entitlements.assert(ctx, 'products.create', 1);
  return deps.database.transaction(async (tx) => {
    if (id) {
      const cur = await productRepo.get(tx, ctx, id);
      if (!cur) throw new BusinessError('PRODUCT_NOT_FOUND');
      const { data, lines } = await validateProduct(tx, ctx, input, id);
      await productRepo.update(tx, ctx, id, { ...data, photoFileId: cur.photoFileId }, lines);
      return getProduct(tx, ctx, id);
    }
    const { data, lines } = await validateProduct(tx, ctx, input);
    return getProduct(tx, ctx, (await productRepo.insert(tx, ctx, data, lines)).id);
  });
}

/** "Guardar como variante nueva": a new piece whose parent is `fromId` (keeps the original's photo). */
export async function saveProductAsVariant(deps: UseCaseDeps, ctx: Ctx, fromId: string, raw: unknown): Promise<Product> {
  const input = ProductInput.parse(raw);
  await deps.entitlements.assert(ctx, 'products.create', 1);
  return deps.database.transaction(async (tx) => {
    const from = await productRepo.get(tx, ctx, fromId);
    if (!from) throw new BusinessError('PRODUCT_NOT_FOUND');
    const { data, lines } = await validateProduct(tx, ctx, { ...input, parentId: fromId });
    return getProduct(tx, ctx, (await productRepo.insert(tx, ctx, { ...data, photoFileId: from.photoFileId }, lines)).id);
  });
}

/**
 * Soft delete + restore. Collections and variants keep their link and simply ignore a deleted piece, so
 * "Deshacer" brings everything back. Phase 3 adds: blocked while in an active order or with stock.
 */
export async function deleteProduct(deps: UseCaseDeps, ctx: Ctx, id: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!(await productRepo.setDeleted(tx, ctx, id, !restore))) throw new BusinessError('PRODUCT_NOT_FOUND');
  });
}

export async function setProductPhoto(deps: UseCaseDeps, ctx: Ctx, id: string, fileId: string | null): Promise<Product> {
  return deps.database.transaction(async (tx) => {
    if (!(await productRepo.setPhoto(tx, ctx, id, fileId))) throw new BusinessError('PRODUCT_NOT_FOUND');
    return getProduct(tx, ctx, id);
  });
}

export async function saveCollection(deps: UseCaseDeps, ctx: Ctx, id: string | null, raw: unknown): Promise<Collection> {
  const input = CollectionInput.parse(raw);
  const parts = mergeParts(input.parts);
  if (!parts.length) throw new BusinessError('COLLECTION_NEEDS_PART');
  return deps.database.transaction(async (tx) => {
    for (const p of parts) if (!(await productRepo.get(tx, ctx, p.productId))) throw new BusinessError('PRODUCT_NOT_FOUND');
    const data = { name: input.name, priceCents: input.priceCents && input.priceCents > 0 ? input.priceCents : null, extrasCents: input.extrasCents, tags: [...new Set(input.tags)], note: input.note };
    if (id) {
      if (!(await collectionRepo.update(tx, ctx, id, data, parts))) throw new BusinessError('COLLECTION_NOT_FOUND');
      return getCollection(tx, ctx, id);
    }
    return getCollection(tx, ctx, (await collectionRepo.insert(tx, ctx, data, parts)).id);
  });
}

export async function deleteCollection(deps: UseCaseDeps, ctx: Ctx, id: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!(await collectionRepo.setDeleted(tx, ctx, id, !restore))) throw new BusinessError('COLLECTION_NOT_FOUND');
  });
}
