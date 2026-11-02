// Printers and maintenance (docs/04 §11, docs/06 §8, docs/12 §8).
import { BusinessError, type CompleteMaintenanceInput, type MaintenanceTaskInput, type PrinterInput, type PrintersOutput, type PrinterView } from '@app/contract';
import { BASE_MAINTENANCE, investmentRecovered, maintenanceState, MAINTENANCE_EXPENSE_CATEGORY, tidyName, toCents } from '@app/core';
import {
  deleteTask, getPrinter, getTask, insertExpense, insertPrinter, insertTasks, listPrinters, listTasks, setPrinterDeleted, transaction,
  updatePrinter as updateRow, updateTask, type Ctx, type Executor, type MaintenanceTaskRow, type PrinterRow,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';

/** Things that live in later phases (queues, profit, expenses) plug in here without an `if` (filled in phase 3). */
export interface PrinterHooks {
  queue(tx: Executor, ctx: Ctx, printerIds: readonly string[], now: Date): Promise<Map<string, PrinterView['queue']>>;
  grossProfitAndExpenses(tx: Executor, ctx: Ctx, today: string): Promise<{ grossProfit: number; expenses: number }>;
}
export const printerHooks: PrinterHooks = {
  queue: async () => new Map(),
  grossProfitAndExpenses: async () => ({ grossProfit: 0, expenses: 0 }),
};

function taskView(t: MaintenanceTaskRow, hours: number) {
  const s = maintenanceState({ everyHours: t.everyHours, lastHours: t.lastHours }, hours);
  return { id: t.id, task: t.task, everyHours: t.everyHours, lastHours: t.lastHours, lastOn: t.lastOn ?? null, remaining: Math.round(s.remaining * 100) / 100, usage: s.usage, status: s.status };
}

export async function printersOutput(deps: Deps, ex: Executor, ctx: Ctx): Promise<PrintersOutput> {
  const printers = await listPrinters(ex, ctx);
  const tasks = await listTasks(ex, ctx, printers.map((p) => p.id));
  const queues = await printerHooks.queue(ex, ctx, printers.map((p) => p.id), deps.clock.now());
  const money = await printerHooks.grossProfitAndExpenses(ex, ctx, deps.clock.today());
  const inv = investmentRecovered(money.grossProfit, money.expenses, printers.map((p) => ({ id: p.id, costPesos: p.costCents / 100, hours: p.hours })));
  return {
    items: printers.map((p) => {
      const queue = queues.get(p.id) ?? [];
      const roi = inv.perPrinter.find((x) => x.id === p.id)!;
      return {
        ...printerBase(p), status: queue.some((q) => q.startedAt) ? 'printing' : 'idle', queue,
        maintenance: tasks.filter((t) => t.printerId === p.id).map((t) => taskView(t, p.hours)),
        roi: { recoveredCents: toCents(roi.contribution), pct: Math.round(roi.pct * 10) / 10 },
      };
    }),
    investment: { equipmentCents: toCents(inv.equipment), hours: inv.hours, netCents: toCents(inv.net), recoveredPct: Math.round(inv.recoveredPct * 10) / 10 },
  };
}

const printerBase = (p: PrinterRow) => ({ id: p.id, name: p.name, costCents: p.costCents, lifeHours: p.lifeHours, maintenanceCentsPerHour: p.maintenanceCentsPerHour, kw: p.kw, hours: p.hours, purchasedOn: p.purchasedOn ?? null });

async function one(deps: Deps, ex: Executor, ctx: Ctx, id: string): Promise<PrinterView> {
  const p = (await printersOutput(deps, ex, ctx)).items.find((x) => x.id === id);
  if (!p) throw notFound('printer');
  return p;
}

/** A new printer comes with the 3 base tasks, counting from its current hours (mockup). */
export async function createPrinter(deps: Deps, ctx: Ctx, input: PrinterInput) {
  return transaction(deps.db, async (tx) => {
    await deps.entitlements.assert(ctx, 'printers.create', 1);
    const p = await insertPrinter(tx, ctx, { id: deps.ids.next(), name: tidyName(input.name), costCents: input.costCents, lifeHours: input.lifeHours, maintenanceCentsPerHour: input.maintenanceCentsPerHour, kw: input.kw, hours: input.hours ?? 0, purchasedOn: input.purchasedOn ?? null });
    await insertTasks(tx, ctx, BASE_MAINTENANCE.map((t, i) => ({ id: deps.ids.next(), printerId: p.id, task: t.task, everyHours: t.everyHours, lastHours: p.hours, position: i })));
    return one(deps, tx, ctx, p.id);
  });
}

export async function updatePrinter(deps: Deps, ctx: Ctx, id: string, input: PrinterInput) {
  return transaction(deps.db, async (tx) => {
    const r = await updateRow(tx, ctx, id, { name: tidyName(input.name), costCents: input.costCents, lifeHours: input.lifeHours, maintenanceCentsPerHour: input.maintenanceCentsPerHour, kw: input.kw, purchasedOn: input.purchasedOn ?? null, ...(input.hours !== undefined ? { hours: input.hours } : {}) });
    if (!r) throw notFound('printer');
    return one(deps, tx, ctx, id);
  });
}

/** Soft delete; a printer with jobs in its queue cannot go (docs/12 §8). */
export async function deletePrinter(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    const p = await getPrinter(tx, ctx, id);
    if (!p) throw notFound('printer');
    const jobs = (await printerHooks.queue(tx, ctx, [id], deps.clock.now())).get(id)?.length ?? 0;
    if (jobs) throw new BusinessError('PRINTER_HAS_QUEUE', { name: p.name, jobs });
    await setPrinterDeleted(tx, ctx, id, deps.clock.now());
  });
}

export async function restorePrinter(deps: Deps, ctx: Ctx, id: string) {
  return transaction(deps.db, async (tx) => {
    if (!(await getPrinter(tx, ctx, id, { deleted: true }))) throw notFound('printer');
    await setPrinterDeleted(tx, ctx, id, null);
    return one(deps, tx, ctx, id);
  });
}

async function livePrinter(tx: Executor, ctx: Ctx, id: string) {
  const p = await getPrinter(tx, ctx, id);
  if (!p) throw notFound('printer');
  return p;
}

export async function createMaintenanceTask(deps: Deps, ctx: Ctx, printerId: string, input: MaintenanceTaskInput) {
  return transaction(deps.db, async (tx) => {
    const p = await livePrinter(tx, ctx, printerId);
    const count = (await listTasks(tx, ctx, [printerId])).length;
    if (count >= 30) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'task', rule: 'too_big', params: { max: 30 } }] });
    const [t] = await insertTasks(tx, ctx, [{ id: deps.ids.next(), printerId, task: tidyName(input.task), everyHours: input.everyHours, lastHours: input.lastHours ?? p.hours, position: count }]);
    return taskView(t!, p.hours);
  });
}

export async function updateMaintenanceTask(deps: Deps, ctx: Ctx, printerId: string, taskId: string, input: MaintenanceTaskInput) {
  return transaction(deps.db, async (tx) => {
    const p = await livePrinter(tx, ctx, printerId);
    if (!(await getTask(tx, ctx, printerId, taskId))) throw notFound('maintenance_task');
    const t = await updateTask(tx, ctx, taskId, { task: tidyName(input.task), everyHours: input.everyHours, ...(input.lastHours !== undefined ? { lastHours: input.lastHours } : {}) });
    return taskView(t!, p.hours);
  });
}

export async function deleteMaintenanceTask(deps: Deps, ctx: Ctx, printerId: string, taskId: string) {
  await transaction(deps.db, async (tx) => {
    await livePrinter(tx, ctx, printerId);
    if (!(await getTask(tx, ctx, printerId, taskId))) throw notFound('maintenance_task');
    await deleteTask(tx, ctx, taskId);
  });
}

/** "Hecho": counts again from the current hours and, with a cost, records an expense (docs/06 §8). */
export async function completeMaintenance(deps: Deps, ctx: Ctx, printerId: string, taskId: string, input: CompleteMaintenanceInput) {
  return transaction(deps.db, async (tx) => {
    const p = await livePrinter(tx, ctx, printerId);
    const t = await getTask(tx, ctx, printerId, taskId);
    if (!t) throw notFound('maintenance_task');
    const task = await updateTask(tx, ctx, taskId, { lastHours: p.hours, lastOn: input.on });
    const expense = input.costCents && input.costCents > 0
      ? await insertExpense(tx, ctx, { id: deps.ids.next(), on: input.on, concept: `${t.task} · ${p.name}`, category: MAINTENANCE_EXPENSE_CATEGORY, amountCents: input.costCents, recurring: false })
      : null;
    return {
      task: taskView(task!, p.hours),
      expense: expense ? { id: expense.id, on: expense.on, concept: expense.concept, category: expense.category, amountCents: expense.amountCents, recurring: expense.recurring, endsOn: expense.endsOn ?? null } : undefined,
    };
  });
}
