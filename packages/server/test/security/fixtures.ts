// Two businesses with full data for the security tests: B gets the whole mockup seed, A a small set.
import { connectPglite, ensureWorkspace, type Ctx, type Database } from '@app/db';
import { quickRobotSeed } from '@app/db/seed';
import { createApp } from '../../src/app';
import type { AppDeps, Session } from '../../src/deps';
import { localDeps } from '../../src/local-deps';
import { memoryLogger } from '../../src/logging';
import { listCatalogue } from '../../src/queries/catalogue';
import { listFilaments } from '../../src/queries/filaments';
import { listPrinters } from '../../src/queries/printers';
import { listSupplies } from '../../src/queries/supplies';
import { getSettingsBundle } from '../../src/queries/settings';
import { applySeed } from '../../dev/seed';
import { ctxA, ctxB } from '../helpers';

export { ctxA, ctxB };
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

export async function twoBusinesses(): Promise<Database> {
  const database = await connectPglite();
  for (const [ctx, name] of [[ctxA, 'A'], [ctxB, 'B']] as const)
    await ensureWorkspace(database.db, { workspaceId: ctx.workspaceId, workspaceName: name, userId: ctx.userId, userEmail: `${name}@example.test`, userName: name });
  await applySeed(database, ctxB, quickRobotSeed('2026-11-02'), '2026-11-02');
  await applySeed(database, ctxA, quickRobotSeed('2026-11-02'), '2026-11-02');
  return database;
}

/** App whose session is fixed to `ctx` with `role`. */
export function appAs(database: Database, ctx: Ctx, role: Session['role'] = 'owner', extra: Partial<AppDeps> = {}) {
  const logger = memoryLogger();
  const deps: AppDeps = { ...localDeps({ database, workspaceId: ctx.workspaceId, userId: ctx.userId, filesDir: '/tmp/app-sec-files', logger }), ...extra };
  if (!extra.auth) deps.auth = { resolve: async () => ({ ...ctx, role }) };
  return { app: createApp(deps), logger };
}

/** Everything business B has, to prove A could not change it. */
export async function snapshot(database: Database, ctx: Ctx) {
  const x = database.db;
  return JSON.stringify(await Promise.all([listCatalogue(x, ctx), listFilaments(x, ctx), listSupplies(x, ctx), listPrinters(x, ctx), getSettingsBundle(x, ctx)]));
}
