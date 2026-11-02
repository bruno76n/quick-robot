// Serves the built web app in local mode (apps/web/dist), with SPA fallback. Paths cannot escape the root.
import { readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import type { Hono } from 'hono';
import type { AppEnv } from './env';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
};

export function serveWeb(app: Hono<AppEnv>, root: string) {
  const base = resolve(root);
  const file = (p: string) => {
    const full = resolve(base, `.${decodeURIComponent(p)}`);
    if (full !== base && !full.startsWith(base + sep)) return undefined;
    try { return statSync(full).isFile() ? full : undefined; } catch { return undefined; }
  };
  app.get('*', (c) => {
    let path: string;
    try { path = new URL(c.req.url).pathname; } catch { return c.notFound(); }
    const hit = file(path);
    const target = hit ?? (extname(path) ? undefined : file('/index.html'));
    if (!target) return c.notFound();
    const type = TYPES[extname(target)] ?? 'application/octet-stream';
    const immutable = target.includes(`${sep}assets${sep}`);
    return c.body(readFileSync(target), 200, { 'Content-Type': type, 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  });
}
