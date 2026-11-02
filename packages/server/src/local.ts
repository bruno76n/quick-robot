// Local composition helpers shared by the dev runner and apps/desktop: build the local deps.
import { LIMITS } from '@app/contract';
import { connectPglite, ensureWorkspace, openLocalDatabase } from '@app/db';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { systemClock, uuidV7Ids } from './clock';
import type { Deps } from './deps';
import { createLogger, stdoutSink, type Sink } from './logger';
import { LOCAL_USER_ID, LOCAL_WORKSPACE_ID, localAuth } from './providers/local/auth';
import { folderBackupStore, memoryBackupStore } from './providers/local/backups';
import { unlimitedEntitlements } from './providers/local/entitlements';
import { diskFileStore, memoryFileStore } from './providers/local/files';
import { rotatingFileSink } from './providers/local/log-file';
import { nullMailer } from './providers/local/mailer';
import type { LocalConfig } from './config';
import { ensureWorkspaceDefaults } from './usecases/settings';

export const LOCAL_CTX = { workspaceId: LOCAL_WORKSPACE_ID, userId: LOCAL_USER_ID };

export async function localDeps(cfg: LocalConfig, opts: { version: string; sink?: Sink; workspaceName?: string }) {
  const clock = systemClock(cfg.timeZone);
  if (cfg.dataDir) mkdirSync(cfg.dataDir, { recursive: true, mode: 0o700 });
  // With a data folder: copy before migrating and put the copy back if a migration fails (docs/02 §6).
  const opened = cfg.dataDir ? await openLocalDatabase(cfg.dataDir) : null;
  const conn = opened?.conn ?? await connectPglite({});
  await ensureWorkspace(conn.db, LOCAL_CTX, { name: opts.workspaceName ?? '', email: 'local@localhost', userName: '' });
  const sink = opts.sink ?? (cfg.dataDir ? rotatingFileSink(join(cfg.dataDir, 'logs')) : stdoutSink);
  const deps: Deps = {
    db: conn.db,
    auth: localAuth(cfg.secret ? { secret: cfg.secret } : {}),
    files: cfg.dataDir ? diskFileStore(join(cfg.dataDir, 'files')) : memoryFileStore(),
    entitlements: unlimitedEntitlements,
    mailer: nullMailer,
    backups: cfg.dataDir ? folderBackupStore(join(cfg.dataDir, 'backups'), clock) : memoryBackupStore(clock),
    clock,
    ids: uuidV7Ids,
    logger: createLogger(sink),
    mode: 'local',
    importLimitMb: LIMITS.importMbLocal,
    version: opts.version,
    allowedOrigins: cfg.allowedOrigins,
  };
  await ensureWorkspaceDefaults(deps, LOCAL_CTX);
  if (opened?.backupPath) deps.logger.info('data updated', { from: opened.from, to: opened.to, backup: opened.backupPath });
  return { deps, conn, opened };
}
