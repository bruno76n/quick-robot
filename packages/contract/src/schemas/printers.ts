import { z } from 'zod';
import { Id, IsoDate, Name, NonNegativeMoney } from './common';

export const MaintenanceStatus = z.enum(['due', 'soon', 'ok']);
export type MaintenanceStatus = z.infer<typeof MaintenanceStatus>;

export const MaintenanceTask = z.object({
  id: Id,
  task: z.string(),
  everyHours: z.number(),
  lastHours: z.number(),
  lastOn: IsoDate.nullable(),
  remaining: z.number(),
  usage: z.number(),
  status: MaintenanceStatus,
});
export type MaintenanceTask = z.infer<typeof MaintenanceTask>;

export const Printer = z.object({
  id: Id,
  name: z.string(),
  costCents: z.number().int(),
  lifeHours: z.number(),
  maintenanceCentsPerHour: z.number().int(),
  kw: z.number(),
  hours: z.number(),
  purchasedOn: IsoDate.nullable(),
  /** Pesos per hour. */
  machinePerHour: z.number(),
  electricityPerHour: z.number(),
  lifeUsedPct: z.number(),
  recovery: z.object({ contributionCents: z.number().int(), pct: z.number() }),
  tasks: z.array(MaintenanceTask),
});
export type Printer = z.infer<typeof Printer>;

export const PrinterList = z.object({
  items: z.array(Printer),
  summary: z.object({ equipmentCents: z.number().int(), netCents: z.number().int(), recoveredPct: z.number(), hours: z.number(), pendingTasks: z.number().int() }),
});
export type PrinterList = z.infer<typeof PrinterList>;

export const PrinterInput = z.object({
  name: Name,
  costCents: NonNegativeMoney,
  lifeHours: z.number().min(1).max(1_000_000).default(5000),
  maintenanceCentsPerHour: NonNegativeMoney.default(0),
  kw: z.number().min(0).max(10).default(0),
  hours: z.number().min(0).max(1_000_000).default(0),
  purchasedOn: IsoDate.nullable().default(null),
});
export type PrinterInput = z.input<typeof PrinterInput>;

export const MaintenanceTaskInput = z.object({ task: Name, everyHours: z.number().min(1).max(1_000_000) });
export type MaintenanceTaskInput = z.input<typeof MaintenanceTaskInput>;
export const CompleteMaintenanceInput = z.object({ on: IsoDate, costCents: NonNegativeMoney.default(0) });
export type CompleteMaintenanceInput = z.input<typeof CompleteMaintenanceInput>;
