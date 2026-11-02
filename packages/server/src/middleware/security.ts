// HTTP hardening (docs/11 · A01, A02, A05, A06): security headers, same-origin writes, JSON bodies,
// size limits and a write rate limit.
import { createMiddleware } from 'hono/factory';
import { bodyLimit } from 'hono/body-limit';
import { BusinessError } from '@app/contract';
import type { AppEnv } from '../env';
import type { SecurityOptions } from '../security-options';

export { defaultSecurity, type SecurityOptions } from '../security-options';


export const MAX_JSON_BYTES = 64 * 1024;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React sets style properties and Radix injects a small <style> for scroll locking.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const securityHeaders = (o: SecurityOptions) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();
    const h = c.res.headers;
    if (!h.has('content-security-policy')) h.set('content-security-policy', CSP);
    h.set('x-content-type-options', 'nosniff');
    h.set('x-frame-options', 'DENY');
    h.set('referrer-policy', 'no-referrer');
    h.set('cross-origin-opener-policy', 'same-origin');
    h.set('cross-origin-resource-policy', 'same-origin');
    h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    if (c.req.path.startsWith('/api/')) h.set('cache-control', h.get('cache-control') ?? 'no-store');
    if (o.hsts) h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  });

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Writes only from the app itself: a browser request from another site (Origin / Sec-Fetch-Site) is refused,
 * and bodies must be JSON (or an image for uploads). This blocks cross-site requests to the local server too.
 */
export const sameOriginWrites = (o: SecurityOptions) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (SAFE.has(c.req.method)) return next();
    const site = c.req.header('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') throw new BusinessError('FORBIDDEN', 'Cross-site request');
    const origin = c.req.header('origin');
    if (origin) {
      const self = new URL(c.req.url).origin;
      if (origin !== self && !o.allowedOrigins.includes(origin)) throw new BusinessError('FORBIDDEN', 'Origin not allowed');
    }
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const hasBody = c.req.raw.body !== null || Number(c.req.header('content-length') ?? 0) > 0;
    const upload = c.req.path.endsWith('/files') || c.req.path.endsWith('/files/');
    if (hasBody && !(upload ? type.startsWith('image/') : type === 'application/json')) throw new BusinessError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported content type');
    return next();
  });

/** JSON bodies are small; uploads have their own limit. */
export const jsonBodyLimit = bodyLimit({
  maxSize: MAX_JSON_BYTES,
  onError: () => {
    throw new BusinessError('PAYLOAD_TOO_LARGE');
  },
});

/** Fixed-window counter per user (in memory): enough for one process; the cloud adds an edge limit. */
export function rateLimit(o: SecurityOptions, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; writes: number; uploads: number }>();
  return createMiddleware<AppEnv>(async (c, next) => {
    if (SAFE.has(c.req.method)) return next();
    const ctx = c.get('ctx');
    const key = `${ctx.workspaceId}:${ctx.userId}`;
    const t = now();
    let w = windows.get(key);
    if (!w || t - w.start >= 60_000) {
      w = { start: t, writes: 0, uploads: 0 };
      windows.set(key, w);
      if (windows.size > 10_000) windows.clear();
    }
    const upload = c.req.path.endsWith('/files');
    if (upload ? ++w.uploads > o.uploadsPerMinute : ++w.writes > o.writesPerMinute) throw new BusinessError('RATE_LIMITED');
    return next();
  });
}
