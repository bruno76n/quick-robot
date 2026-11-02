import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { filament, spool, spoolMovement } from '../schema';

export type FilamentRow = typeof filament.$inferSelect;
export type SpoolRow = typeof spool.$inferSelect;
export type SpoolMovementRow = typeof spoolMovement.$inferSelect;
export type SpoolMovementKind = SpoolMovementRow['kind'];

const liveFilaments = (ws: string) => and(eq(filament.workspaceId, ws), isNull(filament.deletedAt));
const liveSpools = (ws: string) => and(eq(spool.workspaceId, ws), isNull(spool.deletedAt));

/** Every method takes ctx and filters by ctx.workspaceId. */
export const filamentRepo = {
  async findByKey(ex: Executor, ctx: Ctx, nameKey: string): Promise<FilamentRow | undefined> {
    const ws = assertCtx(ctx);
    const [row] = await ex.select().from(filament).where(and(eq(filament.workspaceId, ws), eq(filament.nameKey, nameKey)));
    return row;
  },

  async get(ex: Executor, ctx: Ctx, id: string): Promise<FilamentRow | undefined> {
    const ws = assertCtx(ctx);
    const [row] = await ex.select().from(filament).where(and(liveFilaments(ws), eq(filament.id, id)));
    return row;
  },

  async list(ex: Executor, ctx: Ctx): Promise<FilamentRow[]> {
    const ws = assertCtx(ctx);
    return ex.select().from(filament).where(liveFilaments(ws)).orderBy(asc(filament.material), asc(filament.color));
  },

  async create(ex: Executor, ctx: Ctx, data: { material: string; color: string; hex: string; nameKey: string }): Promise<FilamentRow> {
    const ws = assertCtx(ctx);
    const [row] = await ex.insert(filament).values({ id: newId(), workspaceId: ws, ...data }).returning();
    return row!;
  },

  /** Restores a soft-deleted filament (same material + color added again). */
  async restore(ex: Executor, ctx: Ctx, id: string): Promise<void> {
    const ws = assertCtx(ctx);
    await ex.update(filament).set({ deletedAt: null, updatedAt: new Date() }).where(and(eq(filament.workspaceId, ws), eq(filament.id, id)));
  },

  async listSpools(ex: Executor, ctx: Ctx, filamentIds?: readonly string[]): Promise<SpoolRow[]> {
    const ws = assertCtx(ctx);
    if (filamentIds && filamentIds.length === 0) return [];
    const where = filamentIds ? and(liveSpools(ws), inArray(spool.filamentId, [...filamentIds])) : liveSpools(ws);
    return ex.select().from(spool).where(where).orderBy(asc(spool.purchasedOn), asc(spool.id));
  },

  async getSpool(ex: Executor, ctx: Ctx, id: string, withDeleted = false): Promise<SpoolRow | undefined> {
    const ws = assertCtx(ctx);
    const [row] = await ex.select().from(spool).where(and(withDeleted ? eq(spool.workspaceId, ws) : liveSpools(ws), eq(spool.id, id)));
    return row;
  },

  async updateSpool(
    ex: Executor,
    ctx: Ctx,
    id: string,
    data: Partial<Pick<SpoolRow, 'filamentId' | 'brand' | 'costCents' | 'shippingCents' | 'grams' | 'purchasedOn' | 'supplierId'>>,
  ): Promise<number> {
    const ws = assertCtx(ctx);
    const r = await ex.update(spool).set({ ...data, updatedAt: new Date() }).where(and(liveSpools(ws), eq(spool.id, id))).returning({ id: spool.id });
    return r.length;
  },

  /** Soft delete / restore ("Deshacer"). The ledger rows stay. */
  async setSpoolDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const ws = assertCtx(ctx);
    const r = await ex
      .update(spool)
      .set({ deletedAt: deleted ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(spool.workspaceId, ws), eq(spool.id, id)))
      .returning({ id: spool.id });
    return r.length;
  },

  async setFilamentDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<void> {
    const ws = assertCtx(ctx);
    await ex.update(filament).set({ deletedAt: deleted ? new Date() : null, updatedAt: new Date() }).where(and(eq(filament.workspaceId, ws), eq(filament.id, id)));
  },

  async insertSpool(
    ex: Executor,
    ctx: Ctx,
    data: { filamentId: string; brand: string; costCents: number; shippingCents: number; grams: number; purchasedOn: string; supplierId: string | null },
  ): Promise<SpoolRow> {
    const ws = assertCtx(ctx);
    const [row] = await ex.insert(spool).values({ id: newId(), workspaceId: ws, ...data }).returning();
    return row!;
  },

  /** Ledger insert (movements are never updated). */
  async insertMovement(
    ex: Executor,
    ctx: Ctx,
    data: { spoolId: string; on: string; kind: SpoolMovementKind; grams: number; note: string; refId?: string | null },
  ): Promise<SpoolMovementRow> {
    const ws = assertCtx(ctx);
    const [row] = await ex
      .insert(spoolMovement)
      .values({ id: newId(), workspaceId: ws, refId: data.refId ?? null, spoolId: data.spoolId, on: data.on, kind: data.kind, grams: data.grams, note: data.note })
      .returning();
    return row!;
  },

  /** Σ grams per spool (what is left), for the spools of this workspace. */
  async remainingBySpool(ex: Executor, ctx: Ctx): Promise<Map<string, number>> {
    const ws = assertCtx(ctx);
    const rows = await ex
      .select({ spoolId: spoolMovement.spoolId, grams: sql<string>`sum(${spoolMovement.grams})` })
      .from(spoolMovement)
      .where(eq(spoolMovement.workspaceId, ws))
      .groupBy(spoolMovement.spoolId);
    return new Map(rows.map((r) => [r.spoolId, Number(r.grams)]));
  },

  async listMovements(ex: Executor, ctx: Ctx, spoolIds: readonly string[], limit = 50): Promise<SpoolMovementRow[]> {
    const ws = assertCtx(ctx);
    if (spoolIds.length === 0) return [];
    return ex
      .select()
      .from(spoolMovement)
      .where(and(eq(spoolMovement.workspaceId, ws), inArray(spoolMovement.spoolId, [...spoolIds])))
      .orderBy(desc(spoolMovement.on), desc(spoolMovement.id))
      .limit(limit);
  },
};
