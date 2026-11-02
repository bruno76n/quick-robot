import { createMiddleware } from 'hono/factory';
import { BusinessError } from '@app/contract';
import type { AuthProvider } from '../deps';
import type { AppEnv } from '../env';

/** Resolves the session into `ctx`; no session → 401. */
export const sessionMiddleware = (auth: AuthProvider) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.resolve(c.req.raw);
    if (!session) throw new BusinessError('UNAUTHORIZED', 'No session');
    c.set('ctx', session);
    await next();
  });
