import { eq } from 'drizzle-orm';
import type { Executor } from '../connect';
import { membership, user, workspace } from '../schema';

/**
 * MAINTENANCE ONLY (docs/02 §7.5): creates the workspace/user/membership rows if missing.
 * Used to bootstrap local mode and by the dev seed; never by request handlers.
 */
export async function ensureWorkspace(
  ex: Executor,
  w: { workspaceId: string; workspaceName: string; userId: string; userEmail: string; userName: string },
): Promise<void> {
  await ex.insert(workspace).values({ id: w.workspaceId, name: w.workspaceName }).onConflictDoNothing();
  await ex.insert(user).values({ id: w.userId, email: w.userEmail, name: w.userName }).onConflictDoNothing();
  await ex.insert(membership).values({ workspaceId: w.workspaceId, userId: w.userId, role: 'owner' }).onConflictDoNothing();
}

export async function workspaceExists(ex: Executor, workspaceId: string): Promise<boolean> {
  const rows = await ex.select({ id: workspace.id }).from(workspace).where(eq(workspace.id, workspaceId));
  return rows.length > 0;
}
