import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { guard } from '../middleware/guard';
import { getPrinter, listPrinters } from '../queries/printers';
import { completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, updateMaintenanceTask, updatePrinter } from '../usecases/printers';
import { body } from './body';

export function printerRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', guard('printers.read'), async (c) => c.json(await listPrinters(deps.database.db, c.get('ctx'))))
    .post('/', guard('printers.write'), async (c) => c.json(await createPrinter(deps, c.get('ctx'), await body(c)), 201))
    .get('/:id', guard('printers.read'), async (c) => c.json(await getPrinter(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', guard('printers.write'), async (c) => c.json(await updatePrinter(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', guard('printers.delete'), async (c) => (await deletePrinter(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', guard('printers.delete'), async (c) => (await deletePrinter(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)))
    .post('/:id/tasks', guard('printers.write'), async (c) => c.json(await createMaintenanceTask(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201))
    .put('/tasks/:taskId', guard('printers.write'), async (c) => c.json(await updateMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId'), await body(c))))
    .delete('/tasks/:taskId', guard('printers.write'), async (c) => (await deleteMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId')), c.body(null, 204)))
    .post('/tasks/:taskId/restore', guard('printers.write'), async (c) => (await deleteMaintenanceTask(deps, c.get('ctx'), c.req.param('taskId'), true), c.body(null, 204)))
    .post('/tasks/:taskId/complete', guard('printers.write'), async (c) => c.json(await completeMaintenance(deps, c.get('ctx'), c.req.param('taskId'), await body(c))));
}
