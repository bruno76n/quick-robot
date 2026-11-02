import { and, asc, eq, inArray } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { collection, collectionPart, product, productFilament, productSupply } from '../schema';
import { now, scope, scopeAll } from './helpers';

export type ProductRow = typeof product.$inferSelect;
export type ProductFilamentRow = typeof productFilament.$inferSelect;
export type ProductSupplyRow = typeof productSupply.$inferSelect;
export type CollectionRow = typeof collection.$inferSelect;
export type CollectionPartRow = typeof collectionPart.$inferSelect;

export type ProductData = Pick<
  ProductRow,
  'name' | 'parentId' | 'mode' | 'priceCents' | 'marginPct' | 'printerId' | 'printMinutes' | 'batchSize' | 'extrasCents' | 'tracksStock' | 'tags' | 'note' | 'spec' | 'photoFileId'
>;
export interface ProductLines {
  filaments: { filamentId: string; grams: number }[];
  supplies: { supplyId: string; qty: number }[];
}
export type CollectionData = Pick<CollectionRow, 'name' | 'priceCents' | 'extrasCents' | 'tags' | 'note'>;

export const productRepo = {
  list: (ex: Executor, ctx: Ctx): Promise<ProductRow[]> => ex.select().from(product).where(scope(ctx, product)).orderBy(asc(product.createdAt), asc(product.id)),
  async get(ex: Executor, ctx: Ctx, id: string, withDeleted = false): Promise<ProductRow | undefined> {
    const [row] = await ex.select().from(product).where(withDeleted ? scopeAll(ctx, product, eq(product.id, id)) : scope(ctx, product, eq(product.id, id)));
    return row;
  },
  async lines(ex: Executor, ctx: Ctx, productIds?: readonly string[]): Promise<{ filaments: ProductFilamentRow[]; supplies: ProductSupplyRow[] }> {
    if (productIds && productIds.length === 0) return { filaments: [], supplies: [] };
    const ws = assertCtx(ctx);
    const [filaments, supplies] = await Promise.all([
      ex.select().from(productFilament).where(and(eq(productFilament.workspaceId, ws), productIds ? inArray(productFilament.productId, [...productIds]) : undefined)).orderBy(asc(productFilament.position)),
      ex.select().from(productSupply).where(and(eq(productSupply.workspaceId, ws), productIds ? inArray(productSupply.productId, [...productIds]) : undefined)).orderBy(asc(productSupply.position)),
    ]);
    return { filaments, supplies };
  },
  async insert(ex: Executor, ctx: Ctx, data: ProductData, lines: ProductLines): Promise<ProductRow> {
    const ws = assertCtx(ctx);
    const [row] = await ex.insert(product).values({ id: newId(), workspaceId: ws, ...data }).returning();
    await productRepo.replaceLines(ex, ctx, row!.id, lines);
    return row!;
  },
  async update(ex: Executor, ctx: Ctx, id: string, data: ProductData, lines: ProductLines): Promise<number> {
    const r = await ex.update(product).set({ ...data, updatedAt: now() }).where(scope(ctx, product, eq(product.id, id))).returning({ id: product.id });
    if (r.length) await productRepo.replaceLines(ex, ctx, id, lines);
    return r.length;
  },
  /** Filament and supply lines are part of the product definition (not a ledger): replaced as a whole. */
  async replaceLines(ex: Executor, ctx: Ctx, productId: string, lines: ProductLines): Promise<void> {
    const ws = assertCtx(ctx);
    await ex.delete(productFilament).where(and(eq(productFilament.workspaceId, ws), eq(productFilament.productId, productId)));
    await ex.delete(productSupply).where(and(eq(productSupply.workspaceId, ws), eq(productSupply.productId, productId)));
    if (lines.filaments.length)
      await ex.insert(productFilament).values(lines.filaments.map((f, i) => ({ id: newId(), workspaceId: ws, productId, filamentId: f.filamentId, grams: f.grams, position: i })));
    if (lines.supplies.length)
      await ex.insert(productSupply).values(lines.supplies.map((s, i) => ({ id: newId(), workspaceId: ws, productId, supplyId: s.supplyId, qty: s.qty, position: i })));
  },
  async setDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex.update(product).set({ deletedAt: deleted ? now() : null, updatedAt: now() }).where(scopeAll(ctx, product, eq(product.id, id))).returning({ id: product.id });
    return r.length;
  },
  async setPhoto(ex: Executor, ctx: Ctx, id: string, fileId: string | null): Promise<number> {
    const r = await ex.update(product).set({ photoFileId: fileId, updatedAt: now() }).where(scope(ctx, product, eq(product.id, id))).returning({ id: product.id });
    return r.length;
  },
};

export const collectionRepo = {
  list: (ex: Executor, ctx: Ctx): Promise<CollectionRow[]> => ex.select().from(collection).where(scope(ctx, collection)).orderBy(asc(collection.createdAt), asc(collection.id)),
  async get(ex: Executor, ctx: Ctx, id: string): Promise<CollectionRow | undefined> {
    const [row] = await ex.select().from(collection).where(scope(ctx, collection, eq(collection.id, id)));
    return row;
  },
  async parts(ex: Executor, ctx: Ctx, collectionIds?: readonly string[]): Promise<CollectionPartRow[]> {
    if (collectionIds && collectionIds.length === 0) return [];
    return ex
      .select()
      .from(collectionPart)
      .where(and(eq(collectionPart.workspaceId, assertCtx(ctx)), collectionIds ? inArray(collectionPart.collectionId, [...collectionIds]) : undefined))
      .orderBy(asc(collectionPart.position));
  },
  async insert(ex: Executor, ctx: Ctx, data: CollectionData, parts: { productId: string; qty: number }[]): Promise<CollectionRow> {
    const [row] = await ex.insert(collection).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    await collectionRepo.replaceParts(ex, ctx, row!.id, parts);
    return row!;
  },
  async update(ex: Executor, ctx: Ctx, id: string, data: CollectionData, parts: { productId: string; qty: number }[]): Promise<number> {
    const r = await ex.update(collection).set({ ...data, updatedAt: now() }).where(scope(ctx, collection, eq(collection.id, id))).returning({ id: collection.id });
    if (r.length) await collectionRepo.replaceParts(ex, ctx, id, parts);
    return r.length;
  },
  async replaceParts(ex: Executor, ctx: Ctx, collectionId: string, parts: { productId: string; qty: number }[]): Promise<void> {
    const ws = assertCtx(ctx);
    await ex.delete(collectionPart).where(and(eq(collectionPart.workspaceId, ws), eq(collectionPart.collectionId, collectionId)));
    if (parts.length) await ex.insert(collectionPart).values(parts.map((p, i) => ({ id: newId(), workspaceId: ws, collectionId, productId: p.productId, qty: p.qty, position: i })));
  },
  async setDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex.update(collection).set({ deletedAt: deleted ? now() : null, updatedAt: now() }).where(scopeAll(ctx, collection, eq(collection.id, id))).returning({ id: collection.id });
    return r.length;
  },
};
