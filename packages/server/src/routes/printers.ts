// Printers and maintenance (docs/12 §8).
import { completeMaintenanceInput, maintenanceTaskInput, printerInput } from '@app/contract';
import { body, idParam, noContent, ok } from '../http';
import {
  completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, printersOutput, restorePrinter,
  updateMaintenanceTask, updatePrinter,
} from '../usecases/printers';
import type { Router } from './router';

export function printerRoutes(r: Router) {
  r.get('/printers', 'printer.read', async (c) => ok(c, await printersOutput(c.get('deps'), c.get('deps').db, c.get('ctx'))));
  r.post('/printers', 'printer.create', async (c) => ok(c, await createPrinter(c.get('deps'), c.get('ctx'), await body(c, printerInput)), 201));
  r.patch('/printers/:id', 'printer.update', async (c) => ok(c, await updatePrinter(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), await body(c, printerInput))));
  r.delete('/printers/:id', 'printer.delete', async (c) => { await deletePrinter(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer')); return noContent(c); });
  r.post('/printers/:id/restore', 'printer.delete', async (c) => ok(c, await restorePrinter(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'))));
  r.post('/printers/:id/maintenance', 'maintenance.create', async (c) => ok(c, await createMaintenanceTask(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), await body(c, maintenanceTaskInput)), 201));
  r.patch('/printers/:id/maintenance/:taskId', 'maintenance.update', async (c) => ok(c, await updateMaintenanceTask(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), idParam(c, 'taskId', 'maintenance_task'), await body(c, maintenanceTaskInput))));
  r.delete('/printers/:id/maintenance/:taskId', 'maintenance.delete', async (c) => { await deleteMaintenanceTask(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), idParam(c, 'taskId', 'maintenance_task')); return noContent(c); });
  r.post('/printers/:id/maintenance/:taskId/complete', 'maintenance.complete', async (c) => ok(c, await completeMaintenance(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), idParam(c, 'taskId', 'maintenance_task'), await body(c, completeMaintenanceInput))));
}
