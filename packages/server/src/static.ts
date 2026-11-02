import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Hono } from 'hono';
import type { AppEnv } from './env';

/** Serves the built web app (apps/web/dist) with SPA fallback to index.html. */
export function mountStatic(app: Hono<AppEnv>, webDist: string) {
  const index = join(webDist, 'index.html');
  if (!existsSync(index)) return;
  const root = relative(process.cwd(), webDist) || '.';
  app.use('/*', serveStatic({ root }));
  const html = readFileSync(index, 'utf8');
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(html)));
}
