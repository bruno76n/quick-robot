import { Hono } from 'hono';
import { BusinessError } from '@app/contract';
import type { AppDeps } from './deps';
import type { AppEnv } from './env';
import { errorHandler } from './middleware/errors';
import { sessionMiddleware } from './middleware/session';
import { requestLog } from './middleware/request-log';
import { defaultSecurity, jsonBodyLimit, rateLimit, sameOriginWrites, securityHeaders } from './middleware/security';
import { filamentRoutes } from './routes/filament';
import { workspaceRoutes } from './routes/workspace';
import { settingsRoutes } from './routes/settings';
import { supplierRoutes, supplyRoutes } from './routes/supplies';
import { printerRoutes } from './routes/printers';
import { collectionRoutes, productRoutes } from './routes/products';
import { fileRoutes } from './routes/files';
import { mountStatic } from './static';

/** The whole API. It does not know whether it runs inside Electron or on a host: it gets its deps. */
export function createApp(deps: AppDeps) {
  const security = { ...defaultSecurity, ...deps.security };
  const app = new Hono<AppEnv>();
  app.use('*', requestLog(deps.logger));
  app.use('*', securityHeaders(security));
  app.onError(errorHandler(deps.logger));

  const api = new Hono<AppEnv>();
  api.use('*', sameOriginWrites(security));
  api.use('*', async (c, next) => (c.req.path.endsWith('/files') && c.req.method === 'POST' ? next() : jsonBodyLimit(c, next)));
  api.get('/health', (c) => c.json({ ok: true }));
  api.use('*', sessionMiddleware(deps.auth));
  api.use('*', rateLimit(security));
  api.route('/workspace', workspaceRoutes(deps));
  api.route('/filaments', filamentRoutes(deps));
  api.route('/settings', settingsRoutes(deps));
  api.route('/suppliers', supplierRoutes(deps));
  api.route('/supplies', supplyRoutes(deps));
  api.route('/printers', printerRoutes(deps));
  api.route('/products', productRoutes(deps));
  api.route('/collections', collectionRoutes(deps));
  api.route('/files', fileRoutes(deps));
  api.all('*', () => {
    throw new BusinessError('NOT_FOUND', 'Route not found');
  });
  app.route('/api/v1', api);

  if (deps.webDist) mountStatic(app, deps.webDist);
  return app;
}
