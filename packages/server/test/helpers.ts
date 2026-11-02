import { connectPglite, ensureWorkspace, type Ctx, type Database } from '@app/db';
import { createApp } from '../src/app';
import { localDeps } from '../src/local-deps';
import type { AppDeps } from '../src/deps';
import type { UseCaseDeps } from '../src/usecases/deps';
import { localEntitlements } from '../src/providers/local/entitlements';

export const WS_A = '0190a000-0000-7000-8000-00000000000a';
export const WS_B = '0190a000-0000-7000-8000-00000000000b';
export const ctxA: Ctx = { workspaceId: WS_A, userId: '0190a000-0000-7000-8000-0000000000a1' };
export const ctxB: Ctx = { workspaceId: WS_B, userId: '0190a000-0000-7000-8000-0000000000b1' };

export async function testDatabase(): Promise<Database> {
  const database = await connectPglite();
  for (const [ctx, name] of [[ctxA, 'A'], [ctxB, 'B']] as const) {
    await ensureWorkspace(database.db, { workspaceId: ctx.workspaceId, workspaceName: name, userId: ctx.userId, userEmail: `${name}@example.test`, userName: name });
  }
  return database;
}

export function appFor(database: Database, ctx: Ctx, extra: Partial<AppDeps> = {}) {
  const deps = { ...localDeps({ database, workspaceId: ctx.workspaceId, userId: ctx.userId, filesDir: '/tmp/app-test-files' }), ...extra };
  return createApp(deps);
}

export const spoolInput = (o: Record<string, unknown> = {}) => ({
  material: 'PLA',
  color: 'Blanco',
  hex: '#f1f1ee',
  brand: 'Bambu Lab',
  costCents: 35000,
  shippingCents: 4000,
  grams: 1000,
  purchasedOn: '2026-10-01',
  ...o,
});

export const useCaseDeps = (database: Database, today = '2026-11-02'): UseCaseDeps => ({ database, entitlements: localEntitlements, clock: { today: () => today } });
