import { eq } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { assertCtx, type Ctx } from '../ctx';

/** `workspace_id = ctx.workspaceId`, after checking ctx. Every repository query starts here. */
export function inWorkspace(column: PgColumn, ctx: Ctx) {
  assertCtx(ctx);
  return eq(column, ctx.workspaceId);
}

/** Escape LIKE wildcards in user text; the text itself is still a bound parameter. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
