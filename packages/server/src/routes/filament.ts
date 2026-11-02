import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { guard } from '../middleware/guard';
import { getFilamentDetail, listFilaments } from '../queries/filaments';
import { addSpool } from '../usecases/add-spool';
import { deleteSpool, recordSpoolMovement, updateSpool } from '../usecases/spools';
import { body } from './body';

/** /api/v1/filaments — routes validate, resolve ctx and call a use case or query. No rules here. */
export function filamentRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', guard('filaments.read'), async (c) => c.json(await listFilaments(deps.database.db, c.get('ctx'))))
    .get('/:id', guard('filaments.read'), async (c) => c.json(await getFilamentDetail(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .post('/spools', guard('filaments.write'), async (c) => c.json(await addSpool(deps, c.get('ctx'), await body(c)), 201))
    .put('/spools/:id', guard('filaments.write'), async (c) => c.json(await updateSpool(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/spools/:id', guard('filaments.delete'), async (c) => c.json(await deleteSpool(deps, c.get('ctx'), c.req.param('id'))))
    .post('/spools/:id/restore', guard('filaments.delete'), async (c) => c.json(await deleteSpool(deps, c.get('ctx'), c.req.param('id'), true)))
    .post('/spools/:id/movements', guard('filaments.write'), async (c) => c.json(await recordSpoolMovement(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201));
}
