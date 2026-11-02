import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getFilamentDetail, listFilaments } from '../queries/filaments';
import { addSpool } from '../usecases/add-spool';

/** /api/v1/filaments — routes validate, resolve ctx and call a use case or query. No rules here. */
export function filamentRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listFilaments(deps.database.db, c.get('ctx'))))
    .get('/:id', async (c) => c.json(await getFilamentDetail(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .post('/spools', async (c) => {
      const body = await c.req.json().catch(() => ({}));
      return c.json(await addSpool(deps, c.get('ctx'), body), 201);
    });
}
