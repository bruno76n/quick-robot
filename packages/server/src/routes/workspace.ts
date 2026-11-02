import { Hono } from 'hono';
import { BusinessError } from '@app/contract';
import { getWorkspace } from '@app/db';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';

export function workspaceRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const ws = await getWorkspace(deps.database.db, c.get('ctx'));
    if (!ws) throw new BusinessError('NOT_FOUND', 'Workspace not found');
    return c.json(ws);
  });
}
