import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getPrinter, listPrinters } from '../queries/printers';
import { completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, updateMaintenanceTask, updatePrinter } from '../usecases/printers';
import { body } from './body';

export function printerRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listPrinters(deps.database.db, c.get('ctx'))))
    .post('/', async (c) => c.json(await createPrinter(deps, c.get('ctx'), await body(c)), 201))
    .get('/:id', async (c) => c.json(await getPrinter(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', async (c) => c.json(await updatePrinter(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', async (c) => (await deletePrinter(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', async (c) => (await deletePrinter(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)))
    .post('/:id/tasks', async (c) => c.json(await createMaintenanceTask(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201))
    .put('/tasks/:taskId', async (c) => c.json(await updateMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId'), await body(c))))
    .delete('/tasks/:taskId', async (c) => (await deleteMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId')), c.body(null, 204)))
    .post('/tasks/:taskId/restore', async (c) => (await deleteMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId'), true), c.body(null, 204)))
    .post('/tasks/:taskId/complete', async (c) => c.json(await completeMaintenance(deps, c.get('ctx'), c.req.param('taskId'), await body(c))));
}
