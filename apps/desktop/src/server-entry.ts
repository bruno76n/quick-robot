// The local server inside the app (docs/02 §6), run by the main process with utilityProcess.fork. Same composition as
// scripts/local-server.ts: localDeps + createApp on 127.0.0.1, random port, launch secret, the web build, daily backup.
import { serve } from '@hono/node-server';
import { DataUnreadableError, MigrationFailedError } from '@app/db';
import { createApp, ensureDailyBackup, importWorkspace, loadLocalConfig, localDeps, LOCAL_CTX } from '@app/server';
import { readFile } from 'node:fs/promises';
import { isStartMessage, type ServerMessage, type StartMessage } from './protocol';

const port = process.parentPort;
const post = (m: ServerMessage) => port.postMessage(m);

async function start(msg: StartMessage) {
  const cfg = loadLocalConfig({ host: '127.0.0.1', port: msg.port, dataDir: msg.dataDir, webRoot: msg.webRoot, secret: msg.secret });
  let opened: Awaited<ReturnType<typeof localDeps>>;
  try {
    opened = await localDeps(cfg, { version: msg.version, migrationsFolder: msg.migrationsFolder });
  } catch (e) {
    if (e instanceof MigrationFailedError) post({ type: 'fatal', kind: 'migration', message: e.message, restored: e.restored });
    else post({ type: 'fatal', kind: 'data', message: e instanceof DataUnreadableError ? e.message : String(e) });
    process.exit(2);
  }
  const { deps, conn } = opened;
  process.on('unhandledRejection', (err) => deps.logger.error('unhandled rejection', { err }));
  process.on('uncaughtException', (err) => { deps.logger.error('uncaught exception', { err }); process.exit(1); });
  if (msg.restoreFrom) {
    // A fresh data file: apply the chosen copy before anything else (and without a "backup first" of the empty data,
    // which would replace today's automatic copy).
    try {
      await importWorkspace(deps, LOCAL_CTX, new Uint8Array(await readFile(msg.restoreFrom)), { confirm: true, backupFirst: false });
      deps.logger.info('restored after unreadable data', { file: msg.restoreFrom.split(/[\\/]/).pop() });
    } catch (err) {
      deps.logger.error('restore after unreadable data failed', { err });
      await conn.close().catch(() => undefined);
      post({ type: 'fatal', kind: 'data', message: 'restore failed', restoreFailed: true });
      process.exit(2);
    }
  }
  // One automatic backup per day: when the app opens and then every hour checks if the day changed.
  const daily = () => ensureDailyBackup(deps, LOCAL_CTX).catch((err: unknown) => deps.logger.error('daily backup failed', { err }));
  await daily();
  setInterval(daily, 3_600_000).unref();
  const app = createApp(deps, { webRoot: cfg.webRoot! });
  const server = serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port }, (info) => {
    deps.logger.info('listening', { port: info.port });
    post({ type: 'listening', port: info.port });
  });
  server.on('error', (err) => { deps.logger.error('listen failed', { err }); process.exit(1); });
  // Timeouts (docs/15 §4): 15 s per request.
  const http = server as unknown as { requestTimeout: number; headersTimeout: number };
  http.requestTimeout = 15_000;
  http.headersTimeout = 16_000;
  const stop = async () => { server.close(); await conn.close().catch(() => undefined); process.exit(0); };
  port.on('message', (e: { data: unknown }) => { if ((e.data as { type?: string } | null)?.type === 'stop') void stop(); });
  process.on('SIGTERM', () => void stop());
}

port.once('message', (e: { data: unknown }) => {
  if (!isStartMessage(e.data)) process.exit(3);
  void start(e.data);
});
