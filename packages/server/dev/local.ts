/**
 * Local runner for development (`pnpm dev`) and for trying the app in a browser before Electron exists.
 * Same composition as apps/desktop will do in phase 4: local deps + createApp + listen on 127.0.0.1.
 *
 *   DATA_DIR    folder for the PGlite data (omit → in memory)
 *   PORT        default 8787 (HOST is always 127.0.0.1 / localhost)
 *   SEED        'quick-robot' (default) or 'none'; only applied when the business has no filaments
 *   WEB_DIST    serve the built web app from this folder (default: apps/web/dist if it exists)
 *   LOG_DIR     rotating log file (default: next to DATA_DIR, or none when in memory)
 *   APP_SECRET  per-launch secret required in every request (Electron, phase 4)
 * The configuration is validated at start (src/config.ts): a wrong value stops the server.
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
import { parseLocalConfig } from '../src/config';
import { consoleLogger, teeLogger } from '../src/logging';
import { createFileLogger } from '../src/providers/local/log-file';
import { ensureWorkspaceDefaults } from '../src/usecases/settings';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const config = parseLocalConfig(process.env);
const dataDir = config.DATA_DIR ? resolve(config.DATA_DIR) : undefined;
const port = config.PORT;
const webDist = resolve(config.WEB_DIST ?? `${root}/apps/web/dist`);
const ctx = { workspaceId: LOCAL_WORKSPACE_ID, userId: LOCAL_USER_ID };
const logDir = config.LOG_DIR ? resolve(config.LOG_DIR) : dataDir ? resolve(dataDir, '../logs') : undefined;
const logger = logDir ? teeLogger(consoleLogger, createFileLogger(logDir)) : consoleLogger;

// Fail closed on anything unexpected (docs/11 · A10): log it; an uncaught exception stops the process.
process.on('unhandledRejection', (reason) => logger.log({ level: 'error', msg: 'unhandled rejection', error: String(reason instanceof Error ? reason.stack : reason) }));
process.on('uncaughtException', (err) => {
  logger.log({ level: 'error', msg: 'uncaught exception', error: String(err.stack ?? err) });
  process.exit(1);
});

// Data only readable by this user (docs/11 · Seguridad de tu Mac).
if (dataDir) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const t0 = Date.now();
const database = await connectPglite(dataDir ? { dataDir } : {});
const seed = config.SEED === 'none' ? null : quickRobotSeed(systemClock.today());
await ensureWorkspace(database.db, { workspaceId: LOCAL_WORKSPACE_ID, workspaceName: seed?.workspaceName ?? 'Local', userId: LOCAL_USER_ID, userEmail: 'local@localhost', userName: 'Local' });
if (seed && (await filamentRepo.list(database.db, ctx)).length === 0) await applySeed(database, ctx, seed, systemClock.today());
else await database.transaction((tx) => ensureWorkspaceDefaults(tx, ctx));

const app = createApp(
  localDeps({
    database,
    workspaceId: LOCAL_WORKSPACE_ID,
    userId: LOCAL_USER_ID,
    filesDir: dataDir ? `${dataDir}/../files` : `${root}/.data/dev-files`,
    logger,
    ...(config.APP_SECRET ? { secret: config.APP_SECRET } : {}),
    ...(existsSync(`${webDist}/index.html`) ? { webDist } : {}),
  }),
);
const server = serve({ fetch: app.fetch, hostname: config.HOST, port }, (info) => {
  console.log(`[local] API on http://${config.HOST}:${info.port}/api/v1 · data: ${dataDir ?? 'in memory'} · ready in ${Date.now() - t0} ms`);
});
// Bounded waiting (docs/11 · A10): slow or stuck clients cannot hold the server.
if ('requestTimeout' in server) {
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
}

const shutdown = async () => {
  server.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
