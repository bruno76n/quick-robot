import { connectPglite, ensureWorkspace, type Ctx, type Database } from '../src';

export const WS_A = '0190a000-0000-7000-8000-00000000000a';
export const WS_B = '0190a000-0000-7000-8000-00000000000b';
export const USER_A = '0190a000-0000-7000-8000-0000000000a1';
export const USER_B = '0190a000-0000-7000-8000-0000000000b1';
export const ctxA: Ctx = { workspaceId: WS_A, userId: USER_A };
export const ctxB: Ctx = { workspaceId: WS_B, userId: USER_B };

export async function twoWorkspaces(): Promise<Database> {
  const database = await connectPglite();
  await ensureWorkspace(database.db, { workspaceId: WS_A, workspaceName: 'A', userId: USER_A, userEmail: 'a@example.test', userName: 'A' });
  await ensureWorkspace(database.db, { workspaceId: WS_B, workspaceName: 'B', userId: USER_B, userEmail: 'b@example.test', userName: 'B' });
  return database;
}
