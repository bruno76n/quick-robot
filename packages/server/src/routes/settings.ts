import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getCatalog, getSettingsBundle } from '../queries/settings';
import { addChannel, removeChannel, restoreChannel, updateChannel, updateSettings } from '../usecases/settings';
import { body } from './body';

export function settingsRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await getSettingsBundle(deps.database.db, c.get('ctx'))))
    .patch('/', async (c) => c.json(await updateSettings(deps, c.get('ctx'), await body(c))))
    .post('/channels', async (c) => c.json(await addChannel(deps, c.get('ctx'), await body(c)), 201))
    .patch('/channels/:id', async (c) => c.json(await updateChannel(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/channels/:id', async (c) => (await removeChannel(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/channels/:id/restore', async (c) => (await restoreChannel(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .get('/catalog', async (c) => c.json(await getCatalog(deps.database.db, c.get('ctx'))));
}
