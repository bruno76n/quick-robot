// Local composition helpers shared by the dev runner and apps/desktop: build the local deps.
import { connectPglite, ensureWorkspace } from '@app/db';
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
  const conn = await connectPglite(cfg.dataDir ? { dataDir: join(cfg.dataDir, 'pgdata') } : {});
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
    version: opts.version,
    allowedOrigins: cfg.allowedOrigins,
  };
  await ensureWorkspaceDefaults(deps, LOCAL_CTX);
  return { deps, conn };
}
