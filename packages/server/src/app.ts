import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { BusinessError } from '@app/contract';
import type { AppDeps } from './deps';
import type { AppEnv } from './env';
import { errorHandler } from './middleware/errors';
import { sessionMiddleware } from './middleware/session';
import { filamentRoutes } from './routes/filament';
import { mountStatic } from './static';

/** The whole API. It does not know whether it runs inside Electron or on a host: it gets its deps. */
export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('requestId', randomUUID());
    await next();
  });
  app.onError(errorHandler);

  const api = new Hono<AppEnv>();
  api.get('/health', (c) => c.json({ ok: true, mode: deps.mode }));
  api.use('*', sessionMiddleware(deps.auth));
  api.route('/filaments', filamentRoutes(deps));
  api.all('*', () => {
    throw new BusinessError('NOT_FOUND', 'Route not found');
  });
  app.route('/api/v1', api);

  if (deps.webDist) mountStatic(app, deps.webDist);
  return app;
}
