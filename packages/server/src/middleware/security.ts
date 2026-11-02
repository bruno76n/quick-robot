// Security headers, request id and same-origin JSON writes (docs/11 A01, A02, A05).
import { BusinessError } from '@app/contract';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

export const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(opts: { hsts?: boolean } = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    const h = c.res.headers;
    if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', CSP);
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('X-Frame-Options', 'DENY');
    h.set('Referrer-Policy', 'no-referrer');
    h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'same-origin');
    if (opts.hsts) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (c.req.path.startsWith('/api/') && !h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
    h.delete('X-Powered-By');
  };
}

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = c.get('deps').ids.next();
    c.set('requestId', id);
    c.set('warnings', []);
    await next();
    c.res.headers.set('X-Request-Id', id);
  };
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes must come from our own page: a browser page from another site must not be able to write to the
 * local server (it listens on 127.0.0.1). JSON only, except multipart uploads.
 */
export function sameOriginWrites(allowed: readonly string[] = []): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (WRITE.has(c.req.method)) {
      const site = c.req.header('sec-fetch-site');
      const origin = c.req.header('origin');
      const self = new URL(c.req.url).origin;
      if (site === 'cross-site' || (origin && origin !== self && !allowed.includes(origin))) {
        throw new BusinessError('FORBIDDEN', { capability: 'origin' }, 'Cross-origin write rejected');
      }
      const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      // Browsers send content-length (0 when empty); the Node adapter gives every non-GET request a body stream.
      const declared = c.req.header('content-length');
      const hasBody = declared !== undefined ? Number(declared) > 0 : c.req.header('transfer-encoding') !== undefined || (c.req.raw.body !== null && c.req.method !== 'DELETE');
      if (hasBody && type !== 'application/json' && type !== 'multipart/form-data') {
        throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: '', rule: 'invalid_format' }] }, 'Unsupported content type');
      }
    }
    await next();
  };
}

/** Request body limit (docs/15 §4): 1 MB for JSON. Checked on the declared and on the real size. */
export function bodyLimit(maxBytes: number, multipartMaxBytes: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!WRITE.has(c.req.method)) return next();
    const multipart = (c.req.header('content-type') ?? '').startsWith('multipart/form-data');
    const limit = multipart ? multipartMaxBytes : maxBytes;
    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > limit) throw new BusinessError('PAYLOAD_TOO_LARGE', { maxBytes: limit }, 'Body too large');
    if (c.req.raw.body) {
      const buf = await c.req.raw.clone().arrayBuffer();
      if (buf.byteLength > limit) throw new BusinessError('PAYLOAD_TOO_LARGE', { maxBytes: limit }, 'Body too large');
    }
    return next();
  };
}
