import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { assertCtx, type Ctx } from '../ctx';

/** `workspace_id = ctx.workspaceId` (+ `deleted_at is null` when the table has it). Every query starts here. */
export function scope(ctx: Ctx, t: { workspaceId: PgColumn; deletedAt?: PgColumn }, ...more: (SQL | undefined)[]): SQL {
  const ws = assertCtx(ctx);
  return and(eq(t.workspaceId, ws), t.deletedAt ? isNull(t.deletedAt) : undefined, ...more)!;
}

/** Same filter but including soft-deleted rows (for restore). */
export function scopeAll(ctx: Ctx, t: { workspaceId: PgColumn }, ...more: (SQL | undefined)[]): SQL {
  const ws = assertCtx(ctx);
  return and(eq(t.workspaceId, ws), ...more)!;
}

export const now = () => new Date();
