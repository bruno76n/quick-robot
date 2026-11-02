import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expenseRepo, type Database } from '@app/db';
import { listPrinters } from '../src/queries/printers';
import { completeMaintenance, createMaintenanceTask, createPrinter, deleteMaintenanceTask, deletePrinter, updateMaintenanceTask, updatePrinter } from '../src/usecases/printers';
import { ctxA, ctxB, testDatabase, useCaseDeps } from './helpers';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());
const input = { name: 'Bambu Lab A1', costCents: 600_000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15, hours: 240, purchasedOn: '2026-01-10' };

describe('printers', () => {
  it('a new printer brings the three base tasks counted from its current hours', async () => {
    const p = await createPrinter(useCaseDeps(database), ctxA, input);
    expect(p.tasks.map((t) => [t.task, t.everyHours, t.lastHours, t.status])).toEqual([
      ['Cambiar la boquilla', 300, 240, 'ok'],
      ['Lubricar ejes', 200, 240, 'ok'],
      ['Limpiar la cama', 100, 240, 'ok'],
    ]);
    expect(p.machinePerHour).toBeCloseTo(2.5, 10);
    expect(p.electricityPerHour).toBeCloseTo(0.45, 10);
  });

  it('caso 11.1 through the server: nozzle every 300 h from 0 → at 240 h "soon", at 300 h "due"', async () => {
    const deps = useCaseDeps(database);
    const p = (await listPrinters(database.db, ctxA)).items[0]!;
    const nozzle = p.tasks[0]!;
    await updatePrinter(deps, ctxA, p.id, { ...input, hours: 0 });
    await completeMaintenance(deps, ctxA, nozzle.id, { on: '2026-10-01' });
    let r = await updatePrinter(deps, ctxA, p.id, { ...input, hours: 240 });
    expect(r.tasks[0]).toMatchObject({ remaining: 60, usage: 0.8, status: 'soon' });
    r = await updatePrinter(deps, ctxA, p.id, { ...input, hours: 300 });
    expect(r.tasks[0]!.status).toBe('due');
  });

  it('"Hecho" with a cost resets the task and records an expense', async () => {
    const p = (await listPrinters(database.db, ctxA)).items[0]!;
    const before = await expenseRepo.count(database.db, ctxA);
    const r = await completeMaintenance(useCaseDeps(database), ctxA, p.tasks[0]!.id, { on: '2026-11-01', costCents: 38000 });
    expect(r.tasks[0]).toMatchObject({ lastHours: 300, lastOn: '2026-11-01', status: 'ok' });
    const expenses = await expenseRepo.list(database.db, ctxA);
    expect(expenses.length).toBe(before + 1);
    expect(expenses[0]).toMatchObject({ concept: 'Cambiar la boquilla · Bambu Lab A1', category: 'Mantenimiento y refacciones', amountCents: 38000 });
    expect(await expenseRepo.count(database.db, ctxB)).toBe(0);
  });

  it('tasks CRUD and soft delete of printers', async () => {
    const deps = useCaseDeps(database);
    const p = (await listPrinters(database.db, ctxA)).items[0]!;
    let r = await createMaintenanceTask(deps, ctxA, p.id, { task: 'Revisar correas', everyHours: 150 });
    const t = r.tasks.at(-1)!;
    r = await updateMaintenanceTask(deps, ctxA, t.id, { task: 'Revisar las correas', everyHours: 120 });
    expect(r.tasks.at(-1)).toMatchObject({ task: 'Revisar las correas', everyHours: 120 });
    await deleteMaintenanceTask(deps, ctxA, t.id);
    expect((await listPrinters(database.db, ctxA)).items[0]!.tasks).toHaveLength(3);
    await expect(completeMaintenance(deps, ctxB, p.tasks[0]!.id, { on: '2026-11-01' })).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' });
    await deletePrinter(deps, ctxA, p.id);
    expect((await listPrinters(database.db, ctxA)).items).toEqual([]);
    await deletePrinter(deps, ctxA, p.id, true);
    expect((await listPrinters(database.db, ctxA)).summary).toMatchObject({ equipmentCents: 600_000, recoveredPct: 0 });
  });
});
