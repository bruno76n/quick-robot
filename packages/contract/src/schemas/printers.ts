// Printers and maintenance (docs/12 §8 › Impresoras y mantenimiento).
import { z } from 'zod';
import { calendarDate, cents, id, LIMITS, name } from './common';

const hours = z.number().min(0).max(1_000_000);
export const printerInput = z.object({
  name, costCents: cents(), lifeHours: z.number().min(1).max(1_000_000), maintenanceCentsPerHour: cents(1_000_000),
  kw: z.number().min(0).max(100), purchasedOn: calendarDate.nullable().optional(), hours: hours.optional(),
});
export const maintenanceTaskInput = z.object({ task: name, everyHours: z.number().min(1).max(100_000), lastHours: hours.optional() });
export const completeMaintenanceInput = z.object({ on: calendarDate, costCents: cents().optional() });

export const maintenanceView = z.object({
  id, task: z.string(), everyHours: z.number(), lastHours: z.number(), lastOn: calendarDate.nullable(),
  remaining: z.number(), usage: z.number(), status: z.enum(['ok', 'soon', 'due']),
});
export const queueEntryView = z.object({ id, orderId: id, orderNumber: z.number().int(), text: z.string(), minutes: z.number(), startedAt: z.string().nullable(), remainingMinutes: z.number(), progress: z.number() });
export const printerView = z.object({
  id, name: z.string(), costCents: z.number().int(), lifeHours: z.number(), maintenanceCentsPerHour: z.number().int(), kw: z.number(), hours: z.number(),
  purchasedOn: calendarDate.nullable(), status: z.enum(['printing', 'idle']), queue: z.array(queueEntryView), maintenance: z.array(maintenanceView),
  roi: z.object({ recoveredCents: z.number().int(), pct: z.number() }),
});
export const printersOutput = z.object({ items: z.array(printerView), investment: z.object({ equipmentCents: z.number().int(), hours: z.number(), netCents: z.number().int(), recoveredPct: z.number() }) });
export const expenseView = z.object({ id, on: calendarDate, concept: z.string(), category: z.string(), amountCents: z.number().int(), recurring: z.boolean(), endsOn: calendarDate.nullable() });

export type PrinterInput = z.infer<typeof printerInput>;
export type MaintenanceTaskInput = z.infer<typeof maintenanceTaskInput>;
export type CompleteMaintenanceInput = z.infer<typeof completeMaintenanceInput>;
export type PrinterView = z.infer<typeof printerView>;
export type MaintenanceView = z.infer<typeof maintenanceView>;
export type PrintersOutput = z.infer<typeof printersOutput>;
export const LIMIT_TASKS = LIMITS.maintenanceTasksPerPrinter;
