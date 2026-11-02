// Session → ctx, before anything else happens (docs/12 §1 › Contexto).
import { BusinessError } from '@app/contract';
import type { MiddlewareHandler } from 'hono';
import { can } from '../authz';
import type { AppEnv } from '../env';

export function session(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const s = await c.get('deps').auth.resolve(c.req.raw);
    if (!s) throw new BusinessError('UNAUTHENTICATED', undefined, 'No session');
    c.set('session', s);
    c.set('ctx', { workspaceId: s.workspaceId, userId: s.userId });
    await next();
  };
}

/** Every route declares its action; can() decides, denying by default (docs/11 A01). */
export function guard(action: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('action', action);
    if (!can(c.get('session')?.role, action)) {
      c.get('deps').logger.warn('access denied', { requestId: c.get('requestId'), workspaceId: c.get('ctx')?.workspaceId, action });
      throw new BusinessError('FORBIDDEN', { capability: action }, 'Forbidden');
    }
    await next();
  };
}
