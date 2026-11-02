// Filaments, spools and the spool ledger. Every function takes ctx and filters by workspace.
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { filament, spool, spoolLevels, spoolMovement } from '../schema';
import { inWorkspace, likePattern } from './scope';

export type FilamentRow = typeof filament.$inferSelect;
export type SpoolRow = typeof spool.$inferSelect & { remainingGrams: number };
export type SpoolMovementRow = typeof spoolMovement.$inferSelect;
export type NewSpool = Omit<typeof spool.$inferInsert, 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type NewSpoolMovement = Omit<typeof spoolMovement.$inferInsert, 'workspaceId' | 'createdAt'>;

export async function findFilamentByKey(ex: Executor, ctx: Ctx, nameKey: string): Promise<FilamentRow | undefined> {
  const [row] = await ex.select().from(filament).where(and(inWorkspace(filament.workspaceId, ctx), eq(filament.nameKey, nameKey)));
  return row;
}

export async function getFilament(ex: Executor, ctx: Ctx, id: string): Promise<FilamentRow | undefined> {
  const [row] = await ex.select().from(filament).where(and(inWorkspace(filament.workspaceId, ctx), eq(filament.id, id)));
  return row;
}

export async function insertFilament(ex: Executor, ctx: Ctx, row: Omit<typeof filament.$inferInsert, 'workspaceId'>): Promise<FilamentRow> {
  inWorkspace(filament.workspaceId, ctx);
  const [created] = await ex.insert(filament).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return created!;
}

export async function listFilaments(ex: Executor, ctx: Ctx, opts: { q?: string | undefined; page: number; pageSize: number }) {
  const where = and(
    inWorkspace(filament.workspaceId, ctx),
    opts.q ? or(ilike(filament.material, likePattern(opts.q)), ilike(filament.color, likePattern(opts.q)), ilike(sql`${filament.material} || ' ' || ${filament.color}`, likePattern(opts.q))) : undefined,
  );
  const [total] = await ex.select({ n: count() }).from(filament).where(where);
  const items = await ex.select().from(filament).where(where)
    .orderBy(asc(filament.material), asc(filament.color), asc(filament.id))
    .limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize);
  return { items, total: total?.n ?? 0 };
}

/** Live spools of the given filaments, with what is left (from the spool_levels view). */
export async function listSpools(ex: Executor, ctx: Ctx, filamentIds: readonly string[]): Promise<SpoolRow[]> {
  if (!filamentIds.length) return [];
  const rows = await ex.select({ s: spool, remainingGrams: spoolLevels.remainingGrams }).from(spool)
    .innerJoin(spoolLevels, and(eq(spoolLevels.workspaceId, spool.workspaceId), eq(spoolLevels.spoolId, spool.id)))
    .where(and(inWorkspace(spool.workspaceId, ctx), inArray(spool.filamentId, [...filamentIds]), isNull(spool.deletedAt)))
    .orderBy(asc(spool.purchasedOn), asc(spool.id));
  return rows.map((r) => ({ ...r.s, remainingGrams: Number(r.remainingGrams) }));
}

export async function getSpool(ex: Executor, ctx: Ctx, id: string, opts: { forUpdate?: boolean } = {}) {
  const q = ex.select().from(spool).where(and(inWorkspace(spool.workspaceId, ctx), eq(spool.id, id), isNull(spool.deletedAt)));
  const [row] = opts.forUpdate ? await q.for('update') : await q;
  return row;
}

/** Lock the live spools of a filament so concurrent deductions cannot overdraw them. */
export async function lockSpoolsOfFilament(ex: Executor, ctx: Ctx, filamentId: string) {
  await ex.select({ id: spool.id }).from(spool)
    .where(and(inWorkspace(spool.workspaceId, ctx), eq(spool.filamentId, filamentId), isNull(spool.deletedAt))).for('update');
}

export async function insertSpool(ex: Executor, ctx: Ctx, row: NewSpool) {
  inWorkspace(spool.workspaceId, ctx);
  const [created] = await ex.insert(spool).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return created!;
}

export async function insertSpoolMovements(ex: Executor, ctx: Ctx, rows: readonly NewSpoolMovement[]) {
  inWorkspace(spoolMovement.workspaceId, ctx);
  if (!rows.length) return [];
  return ex.insert(spoolMovement).values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId }))).returning();
}

/** Movements of the live spools of a filament, newest first. */
export async function listSpoolMovements(ex: Executor, ctx: Ctx, filamentId: string, opts: { limit?: number } = {}): Promise<SpoolMovementRow[]> {
  const rows = await ex.select({ m: spoolMovement }).from(spoolMovement)
    .innerJoin(spool, and(eq(spool.workspaceId, spoolMovement.workspaceId), eq(spool.id, spoolMovement.spoolId)))
    .where(and(inWorkspace(spoolMovement.workspaceId, ctx), eq(spool.filamentId, filamentId), isNull(spool.deletedAt)))
    .orderBy(desc(spoolMovement.on), desc(spoolMovement.createdAt), desc(spoolMovement.id))
    .limit(opts.limit ?? 200);
  return rows.map((r) => r.m);
}
