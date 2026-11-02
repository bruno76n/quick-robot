import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getFilamentDetail, listFilaments } from '../queries/filaments';
import { addSpool } from '../usecases/add-spool';
import { deleteSpool, recordSpoolMovement, updateSpool } from '../usecases/spools';
import { body } from './body';

/** /api/v1/filaments — routes validate, resolve ctx and call a use case or query. No rules here. */
export function filamentRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listFilaments(deps.database.db, c.get('ctx'))))
    .get('/:id', async (c) => c.json(await getFilamentDetail(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .post('/spools', async (c) => c.json(await addSpool(deps, c.get('ctx'), await body(c)), 201))
    .put('/spools/:id', async (c) => c.json(await updateSpool(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/spools/:id', async (c) => c.json(await deleteSpool(deps, c.get('ctx'), c.req.param('id'))))
    .post('/spools/:id/restore', async (c) => c.json(await deleteSpool(deps, c.get('ctx'), c.req.param('id'), true)))
    .post('/spools/:id/movements', async (c) => c.json(await recordSpoolMovement(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201));
}
