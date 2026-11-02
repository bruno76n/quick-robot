// Pieces (products), their filaments and supplies, and collections. Every function takes ctx.
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { collection, collectionPart, product, productFilament, productSupply } from '../schema';
import { inWorkspace } from './scope';

export type ProductRow = typeof product.$inferSelect;
export type ProductFilamentRow = typeof productFilament.$inferSelect;
export type ProductSupplyRow = typeof productSupply.$inferSelect;
export type CollectionRow = typeof collection.$inferSelect;
export type CollectionPartRow = typeof collectionPart.$inferSelect;
export interface ProductFull extends ProductRow { filaments: ProductFilamentRow[]; supplies: ProductSupplyRow[] }
export interface CollectionFull extends CollectionRow { parts: CollectionPartRow[] }
type NewRow<T extends { $inferInsert: object }> = Omit<T['$inferInsert'], 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** All live pieces with their filaments and supplies (a small catalog: docs/15 §1, up to ~1 000). */
export async function listProducts(ex: Executor, ctx: Ctx, opts: { ids?: readonly string[]; withDeleted?: boolean } = {}): Promise<ProductFull[]> {
  const rows = await ex.select().from(product)
    .where(and(inWorkspace(product.workspaceId, ctx), opts.withDeleted ? undefined : isNull(product.deletedAt), opts.ids ? inArray(product.id, [...opts.ids]) : undefined))
    .orderBy(asc(product.name), asc(product.id));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const fil = await ex.select().from(productFilament).where(and(inWorkspace(productFilament.workspaceId, ctx), inArray(productFilament.productId, ids))).orderBy(asc(productFilament.position));
  const sup = await ex.select().from(productSupply).where(and(inWorkspace(productSupply.workspaceId, ctx), inArray(productSupply.productId, ids))).orderBy(asc(productSupply.position));
  return rows.map((r) => ({ ...r, filaments: fil.filter((f) => f.productId === r.id), supplies: sup.filter((s) => s.productId === r.id) }));
}

export async function getProduct(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean; forUpdate?: boolean } = {}): Promise<ProductFull | undefined> {
  const where = and(inWorkspace(product.workspaceId, ctx), eq(product.id, id), opts.deleted ? isNotNull(product.deletedAt) : isNull(product.deletedAt));
  const q = ex.select().from(product).where(where);
  const [r] = opts.forUpdate ? await q.for('update') : await q;
  if (!r) return undefined;
  const fil = await ex.select().from(productFilament).where(and(inWorkspace(productFilament.workspaceId, ctx), eq(productFilament.productId, id))).orderBy(asc(productFilament.position));
  const sup = await ex.select().from(productSupply).where(and(inWorkspace(productSupply.workspaceId, ctx), eq(productSupply.productId, id))).orderBy(asc(productSupply.position));
  return { ...r, filaments: fil, supplies: sup };
}

export async function insertProduct(ex: Executor, ctx: Ctx, row: NewRow<typeof product>) {
  inWorkspace(product.workspaceId, ctx);
  const [r] = await ex.insert(product).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updateProduct(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof product>>) {
  const [r] = await ex.update(product).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(product.workspaceId, ctx), eq(product.id, id), isNull(product.deletedAt))).returning();
  return r;
}

/** Replace the filaments and supplies of a piece (they are part of the piece, not a ledger). */
export async function replaceProductParts(ex: Executor, ctx: Ctx, productId: string, filaments: readonly { id: string; filamentId: string; grams: number }[], supplies: readonly { id: string; supplyId: string; qty: number }[]) {
  await ex.delete(productFilament).where(and(inWorkspace(productFilament.workspaceId, ctx), eq(productFilament.productId, productId)));
  await ex.delete(productSupply).where(and(inWorkspace(productSupply.workspaceId, ctx), eq(productSupply.productId, productId)));
  if (filaments.length) await ex.insert(productFilament).values(filaments.map((f, i) => ({ ...f, productId, position: i, workspaceId: ctx.workspaceId })));
  if (supplies.length) await ex.insert(productSupply).values(supplies.map((s, i) => ({ ...s, productId, position: i, workspaceId: ctx.workspaceId })));
}

export async function setProductDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(product).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(product.workspaceId, ctx), eq(product.id, id), deletedAt ? isNull(product.deletedAt) : isNotNull(product.deletedAt))).returning();
  return r;
}

export async function listCollections(ex: Executor, ctx: Ctx, opts: { ids?: readonly string[] } = {}): Promise<CollectionFull[]> {
  const rows = await ex.select().from(collection).where(and(inWorkspace(collection.workspaceId, ctx), isNull(collection.deletedAt), opts.ids ? inArray(collection.id, [...opts.ids]) : undefined)).orderBy(asc(collection.name), asc(collection.id));
  if (!rows.length) return [];
  const parts = await ex.select().from(collectionPart).where(and(inWorkspace(collectionPart.workspaceId, ctx), inArray(collectionPart.collectionId, rows.map((r) => r.id)))).orderBy(asc(collectionPart.position));
  return rows.map((r) => ({ ...r, parts: parts.filter((p) => p.collectionId === r.id) }));
}

export async function getCollection(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}): Promise<CollectionFull | undefined> {
  const [r] = await ex.select().from(collection).where(and(inWorkspace(collection.workspaceId, ctx), eq(collection.id, id), opts.deleted ? isNotNull(collection.deletedAt) : isNull(collection.deletedAt)));
  if (!r) return undefined;
  const parts = await ex.select().from(collectionPart).where(and(inWorkspace(collectionPart.workspaceId, ctx), eq(collectionPart.collectionId, id))).orderBy(asc(collectionPart.position));
  return { ...r, parts };
}

export async function insertCollection(ex: Executor, ctx: Ctx, row: NewRow<typeof collection>) {
  inWorkspace(collection.workspaceId, ctx);
  const [r] = await ex.insert(collection).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updateCollection(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof collection>>) {
  const [r] = await ex.update(collection).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(collection.workspaceId, ctx), eq(collection.id, id), isNull(collection.deletedAt))).returning();
  return r;
}

export async function replaceCollectionParts(ex: Executor, ctx: Ctx, collectionId: string, parts: readonly { id: string; productId: string; qty: number }[]) {
  await ex.delete(collectionPart).where(and(inWorkspace(collectionPart.workspaceId, ctx), eq(collectionPart.collectionId, collectionId)));
  if (parts.length) await ex.insert(collectionPart).values(parts.map((p, i) => ({ ...p, collectionId, position: i, workspaceId: ctx.workspaceId })));
}

export async function setCollectionDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(collection).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(collection.workspaceId, ctx), eq(collection.id, id), deletedAt ? isNull(collection.deletedAt) : isNotNull(collection.deletedAt))).returning();
  return r;
}
