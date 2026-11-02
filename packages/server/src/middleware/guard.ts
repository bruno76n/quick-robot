import { createMiddleware } from 'hono/factory';
import { BusinessError } from '@app/contract';
import { can, type Action } from '../authz';
import type { AppEnv } from '../env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * First middleware of every route: records the action, refuses it if the role cannot do it (403) and treats
 * any id that is not a UUID as "not found" (404) instead of letting it reach the database.
 */
export const guard = (action: Action) =>
  createMiddleware<AppEnv>(async (c, next) => {
    c.set('action', action);
    if (!can(c.get('ctx'), action)) throw new BusinessError('FORBIDDEN', `Not allowed: ${action}`);
    for (const v of Object.values(c.req.param() as Record<string, string>)) if (!UUID.test(v)) throw new BusinessError('NOT_FOUND', 'Invalid id');
    await next();
  });
