import { and, eq } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../db';
import { membership, user, workspace } from '../schema';

export interface WorkspaceRow { id: string; name: string }

/** Local mode: exactly one workspace, user and membership with fixed ids (docs/05). Idempotent. */
export async function ensureWorkspace(ex: Executor, ctx: Ctx, opts: { name: string; email: string; userName: string; role?: 'owner' | 'admin' | 'operator' }) {
  assertCtx(ctx);
  await ex.insert(workspace).values({ id: ctx.workspaceId, name: opts.name }).onConflictDoNothing();
  await ex.insert(user).values({ id: ctx.userId, email: opts.email, name: opts.userName }).onConflictDoNothing();
  await ex.insert(membership).values({ workspaceId: ctx.workspaceId, userId: ctx.userId, role: opts.role ?? 'owner' }).onConflictDoNothing();
}

export async function getWorkspace(ex: Executor, ctx: Ctx): Promise<WorkspaceRow | undefined> {
  assertCtx(ctx);
  const [row] = await ex.select({ id: workspace.id, name: workspace.name }).from(workspace).where(eq(workspace.id, ctx.workspaceId));
  return row;
}

export async function getRole(ex: Executor, ctx: Ctx): Promise<string | undefined> {
  assertCtx(ctx);
  const [row] = await ex.select({ role: membership.role }).from(membership)
    .where(and(eq(membership.workspaceId, ctx.workspaceId), eq(membership.userId, ctx.userId)));
  return row?.role;
}

export async function setWorkspaceName(ex: Executor, ctx: Ctx, name: string) {
  assertCtx(ctx);
  await ex.update(workspace).set({ name, updatedAt: new Date() }).where(eq(workspace.id, ctx.workspaceId));
}
