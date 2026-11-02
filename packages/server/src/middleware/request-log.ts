import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env';
import type { Logger } from '../logging';

/**
 * requestId + one log line per API request: method, route, action, status, duration, workspace.
 * Denied access (401/403), not found on an id (404), deletions, restores and errors are logged as warnings/errors.
 */
export const requestLog = (logger: Logger) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const requestId = randomUUID();
    c.set('requestId', requestId);
    const start = performance.now();
    await next();
    if (!c.req.path.startsWith('/api/')) return;
    const status = c.res.status;
    const ctx = c.get('ctx') as AppEnv['Variables']['ctx'] | undefined;
    const notable = status === 401 || status === 403 || status === 404 || status === 429 || status >= 500 || c.req.method === 'DELETE' || c.req.path.endsWith('/restore');
    logger.log({
      level: status >= 500 ? 'error' : notable ? 'warn' : 'info',
      msg: status === 401 || status === 403 ? 'access denied' : 'request',
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      path: c.req.path,
      action: c.get('action'),
      status,
      ms: Math.round(performance.now() - start),
      workspaceId: ctx?.workspaceId,
      userId: ctx?.userId,
    });
  });
