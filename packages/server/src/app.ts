// createApp(deps): the whole API as a library (docs/02 §3). Electron or the cloud root pass the deps.
import { BusinessError } from '@app/contract';
import { schemaVersion } from '@app/db';
import { Hono } from 'hono';
import type { Deps } from './deps';
import type { AppEnv } from './env';
import { onError } from './middleware/errors';
import { bodyLimit, requestId, sameOriginWrites, securityHeaders } from './middleware/security';
import { session } from './middleware/session';
import { filamentRoutes } from './routes/filament';
import { makeRouter, type RouteDef } from './routes/router';
import { systemRoutes } from './routes/system';
import { settingsRoutes } from './routes/settings';
import { supplyRoutes } from './routes/supplies';
import { printerRoutes } from './routes/printers';
import { productRoutes } from './routes/products';
import { fileRoutes } from './routes/files';
import { sellRoutes } from './routes/sell';
import { workspaceRoutes } from './routes/workspace';
import './usecases/sell/wire';
import { serveWeb } from './static';

export const JSON_LIMIT_BYTES = 1_048_576;
export const MULTIPART_LIMIT_BYTES = 13 * 1024 * 1024;

export interface AppOptions { webRoot?: string }

export function createApp(deps: Deps, opts: AppOptions = {}) {
  const app = new Hono<AppEnv>();
  const routes: RouteDef[] = [];

  app.use('*', async (c, next) => { c.set('deps', deps); await next(); });
  app.use('*', requestId());
  app.use('*', securityHeaders({ hsts: deps.hsts ?? false }));
  app.use('*', async (c, next) => {
    const t0 = performance.now();
    await next();
    if (c.req.path.startsWith('/api/')) {
      const fields = { requestId: c.get('requestId'), workspaceId: c.get('ctx')?.workspaceId, action: c.get('action'), method: c.req.method, path: c.req.routePath, status: c.res.status, ms: Math.round(performance.now() - t0) };
      if (c.req.method === 'DELETE' && c.res.status < 300) deps.logger.warn('deleted', fields);
      else deps.logger.info('request', fields);
    }
  });
  app.onError(onError);

  app.get('/api/v1/health', (c) => c.json({ data: { ok: true, version: deps.version, schemaVersion: schemaVersion() } }));

  app.use('/api/*', sameOriginWrites(deps.allowedOrigins), bodyLimit(JSON_LIMIT_BYTES, MULTIPART_LIMIT_BYTES, { '/api/v1/workspace/import': deps.importLimitMb * 1024 * 1024 }), session());
  const r = makeRouter(app, routes);
  systemRoutes(r);
  filamentRoutes(r);
  settingsRoutes(r);
  supplyRoutes(r);
  printerRoutes(r);
  productRoutes(r);
  fileRoutes(r);
  sellRoutes(r);
  workspaceRoutes(r);

  app.all('/api/*', () => { throw new BusinessError('NOT_FOUND', { entity: 'route' }, 'Route not found'); });
  if (opts.webRoot) serveWeb(app, opts.webRoot);

  return Object.assign(app, { routes });
}

export type App = ReturnType<typeof createApp>;
