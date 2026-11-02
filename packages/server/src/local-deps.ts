import type { Database } from '@app/db';
import type { AppDeps } from './deps';
import { consoleLogger, type Logger } from './logging';
import { createLocalAuth } from './providers/local/auth';
import { systemClock } from './providers/local/clock';
import { localEntitlements } from './providers/local/entitlements';
import { createLocalFiles } from './providers/local/files';
import { noopMailer } from './providers/local/mailer';

/** Fixed ids of the only user and business in local mode (docs/05). */
export const LOCAL_WORKSPACE_ID = '00000000-0000-7000-8000-000000000001';
export const LOCAL_USER_ID = '00000000-0000-7000-8000-000000000002';

/** Local-mode dependencies (used by the dev runner now and by apps/desktop in phase 4). */
export function localDeps(o: { database: Database; workspaceId: string; userId: string; filesDir: string; secret?: string; webDist?: string; logger?: Logger }): AppDeps {
  return {
    database: o.database,
    auth: createLocalAuth({ workspaceId: o.workspaceId, userId: o.userId, ...(o.secret ? { secret: o.secret } : {}) }),
    files: createLocalFiles(o.filesDir),
    entitlements: localEntitlements,
    mailer: noopMailer,
    clock: systemClock,
    logger: o.logger ?? consoleLogger,
    mode: 'local',
    ...(o.webDist ? { webDist: o.webDist } : {}),
  };
}
