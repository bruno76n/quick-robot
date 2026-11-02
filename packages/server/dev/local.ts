/**
 * Local runner for development (`pnpm dev`) and for trying the app in a browser before Electron exists.
 * Same composition as apps/desktop will do in phase 4: local deps + createApp + listen on 127.0.0.1.
 *
 *   DATA_DIR   folder for the PGlite data (omit → in memory)
 *   PORT       default 8787
 *   SEED       'quick-robot' (default) or 'none'; only applied when the business has no filaments
 *   WEB_DIST   serve the built web app from this folder (default: apps/web/dist if it exists)
 */
import { serve } from '@hono/node-server';
import { connectPglite, ensureWorkspace, filamentRepo } from '@app/db';
import { quickRobotSeed } from '@app/db/seed';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app';
import { LOCAL_USER_ID, LOCAL_WORKSPACE_ID, localDeps } from '../src/local-deps';
import { systemClock } from '../src/providers/local/clock';
import { applySeed } from './seed';
import { ensureWorkspaceDefaults } from '../src/usecases/settings';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : undefined;
const port = Number(process.env.PORT ?? 8787);
const webDist = resolve(process.env.WEB_DIST ?? `${root}/apps/web/dist`);
const ctx = { workspaceId: LOCAL_WORKSPACE_ID, userId: LOCAL_USER_ID };

if (dataDir) mkdirSync(dataDir, { recursive: true });
const t0 = Date.now();
const database = await connectPglite(dataDir ? { dataDir } : {});
const seed = process.env.SEED === 'none' ? null : quickRobotSeed(systemClock.today());
await ensureWorkspace(database.db, { workspaceId: LOCAL_WORKSPACE_ID, workspaceName: seed?.workspaceName ?? 'Local', userId: LOCAL_USER_ID, userEmail: 'local@localhost', userName: 'Local' });
if (seed && (await filamentRepo.list(database.db, ctx)).length === 0) await applySeed(database, ctx, seed, systemClock.today());
else await database.transaction((tx) => ensureWorkspaceDefaults(tx, ctx));

const app = createApp(
  localDeps({ database, workspaceId: LOCAL_WORKSPACE_ID, userId: LOCAL_USER_ID, filesDir: dataDir ? `${dataDir}/../files` : `${root}/.data/dev-files`, ...(existsSync(`${webDist}/index.html`) ? { webDist } : {}) }),
);
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`[local] API on http://127.0.0.1:${info.port}/api/v1 · data: ${dataDir ?? 'in memory'} · ready in ${Date.now() - t0} ms`);
});

const shutdown = async () => {
  server.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
