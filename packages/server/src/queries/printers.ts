import { BusinessError, type Printer, type PrinterList } from '@app/contract';
import { fromCents, investmentRecovery, maintenanceStatus, toCents } from '@app/core';
import { expenseRepo, printerRepo, type Ctx, type Executor, type MaintenanceTaskRow, type PrinterRow } from '@app/db';
import { costSettings } from './settings';

/**
 * Gross profit of all sales since always. Sales arrive in phase 3; until then it is 0.
 * Expenses since always: one-off amounts (recurring prorating arrives with Gastos in phase 3).
 */
async function recoveryInputs(ex: Executor, ctx: Ctx): Promise<{ grossProfit: number; expenses: number }> {
  const expenses = (await expenseRepo.list(ex, ctx)).filter((e) => !e.recurring).reduce((t, e) => t + fromCents(e.amountCents), 0);
  return { grossProfit: 0, expenses };
}

function toPrinter(p: PrinterRow, tasks: MaintenanceTaskRow[], kwhPrice: number, recovery: { contribution: number; pct: number }): Printer {
  const cost = fromCents(p.costCents);
  return {
    id: p.id,
    name: p.name,
    costCents: p.costCents,
    lifeHours: p.lifeHours,
    maintenanceCentsPerHour: p.maintenanceCentsPerHour,
    kw: p.kw,
    hours: p.hours,
    purchasedOn: p.purchasedOn,
    machinePerHour: cost / (p.lifeHours || 1) + fromCents(p.maintenanceCentsPerHour),
    electricityPerHour: p.kw * kwhPrice,
    lifeUsedPct: Math.min(100, (p.hours / (p.lifeHours || 1)) * 100),
    recovery: { contributionCents: toCents(recovery.contribution), pct: recovery.pct },
    tasks: tasks.map((t) => ({ id: t.id, task: t.task, everyHours: t.everyHours, lastHours: t.lastHours, lastOn: t.lastOn, ...maintenanceStatus(p.hours, t) })),
  };
}

export async function listPrinters(ex: Executor, ctx: Ctx): Promise<PrinterList> {
  const [rows, tasks, settings, inputs] = await Promise.all([printerRepo.list(ex, ctx), printerRepo.listTasks(ex, ctx), costSettings(ex, ctx), recoveryInputs(ex, ctx)]);
  const r = investmentRecovery(inputs.grossProfit, inputs.expenses, rows.map((p) => ({ id: p.id, cost: fromCents(p.costCents), hours: p.hours })));
  const items = rows.map((p) => toPrinter(p, tasks.filter((t) => t.printerId === p.id), settings.kwhPrice, r.perPrinter.find((x) => x.id === p.id)!));
  return {
    items,
    summary: {
      equipmentCents: toCents(r.equipment),
      netCents: toCents(r.net),
      recoveredPct: r.recoveredPct,
      hours: r.hours,
      pendingTasks: items.reduce((t, p) => t + p.tasks.filter((x) => x.status !== 'ok').length, 0),
    },
  };
}

export async function getPrinter(ex: Executor, ctx: Ctx, id: string): Promise<Printer> {
  const p = (await listPrinters(ex, ctx)).items.find((x) => x.id === id);
  if (!p) throw new BusinessError('PRINTER_NOT_FOUND');
  return p;
}
