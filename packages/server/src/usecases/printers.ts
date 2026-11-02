// Impresoras (docs/06 §8): createPrinter (with the base tasks), updatePrinter, deletePrinter (+ restore),
// maintenance tasks, and completeMaintenance (resets the counter and records an expense if it cost money).
import { BusinessError, CompleteMaintenanceInput, MaintenanceTaskInput, PrinterInput, type Printer } from '@app/contract';
import { BASE_MAINTENANCE_TASKS, MAINTENANCE_EXPENSE_CATEGORY } from '@app/core';
import { expenseRepo, printerRepo, type Ctx } from '@app/db';
import { getPrinter } from '../queries/printers';
import type { UseCaseDeps } from './deps';

export async function createPrinter(deps: UseCaseDeps, ctx: Ctx, raw: unknown): Promise<Printer> {
  const input = PrinterInput.parse(raw);
  await deps.entitlements.assert(ctx, 'printers.create', 1);
  return deps.database.transaction(async (tx) => {
    const p = await printerRepo.insert(tx, ctx, input);
    let position = 0;
    for (const t of BASE_MAINTENANCE_TASKS) await printerRepo.insertTask(tx, ctx, { printerId: p.id, task: t.task, everyHours: t.everyHours, lastHours: input.hours, position: position++ });
    return getPrinter(tx, ctx, p.id);
  });
}

export async function updatePrinter(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<Printer> {
  const input = PrinterInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    if (!(await printerRepo.update(tx, ctx, id, input))) throw new BusinessError('PRINTER_NOT_FOUND');
    return getPrinter(tx, ctx, id);
  });
}

/**
 * Soft delete. Pieces that referenced it keep the reference and are costed with the average of the remaining
 * printers (same result as the mockup; restoring brings everything back). Phase 3: blocked while it has a queue.
 */
export async function deletePrinter(deps: UseCaseDeps, ctx: Ctx, id: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!(await printerRepo.setDeleted(tx, ctx, id, !restore))) throw new BusinessError('PRINTER_NOT_FOUND');
  });
}

export async function createMaintenanceTask(deps: UseCaseDeps, ctx: Ctx, printerId: string, raw: unknown): Promise<Printer> {
  const input = MaintenanceTaskInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const p = await printerRepo.get(tx, ctx, printerId);
    if (!p) throw new BusinessError('PRINTER_NOT_FOUND');
    const tasks = await printerRepo.listTasks(tx, ctx, [printerId]);
    await printerRepo.insertTask(tx, ctx, { printerId, task: input.task, everyHours: input.everyHours, lastHours: p.hours, position: tasks.length });
    return getPrinter(tx, ctx, printerId);
  });
}

export async function updateMaintenanceTask(deps: UseCaseDeps, ctx: Ctx, taskId: string, raw: unknown): Promise<Printer> {
  const input = MaintenanceTaskInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const t = await printerRepo.getTask(tx, ctx, taskId);
    if (!t) throw new BusinessError('TASK_NOT_FOUND');
    await printerRepo.updateTask(tx, ctx, taskId, input);
    return getPrinter(tx, ctx, t.printerId);
  });
}

export async function deleteMaintenanceTask(deps: UseCaseDeps, ctx: Ctx, taskId: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!(await printerRepo.setTaskDeleted(tx, ctx, taskId, !restore))) throw new BusinessError('TASK_NOT_FOUND');
  });
}

/** "Hecho": counts again from the printer's current hours; a cost becomes an expense ("tarea · impresora"). */
export async function completeMaintenance(deps: UseCaseDeps, ctx: Ctx, taskId: string, raw: unknown): Promise<Printer> {
  const input = CompleteMaintenanceInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const t = await printerRepo.getTask(tx, ctx, taskId);
    if (!t) throw new BusinessError('TASK_NOT_FOUND');
    const p = await printerRepo.get(tx, ctx, t.printerId);
    if (!p) throw new BusinessError('PRINTER_NOT_FOUND');
    await printerRepo.updateTask(tx, ctx, taskId, { lastHours: p.hours, lastOn: input.on });
    if (input.costCents > 0)
      await expenseRepo.insert(tx, ctx, { on: input.on, concept: `${t.task} · ${p.name}`, category: MAINTENANCE_EXPENSE_CATEGORY, amountCents: input.costCents, recurring: false, endsOn: null, refId: taskId });
    return getPrinter(tx, ctx, p.id);
  });
}
