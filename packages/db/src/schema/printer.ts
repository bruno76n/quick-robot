import { date, foreignKey, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps, wsIdUnique } from './columns';
import { workspace } from './workspace';

export const printer = pgTable(
  'printer',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    costCents: integer('cost_cents').notNull(),
    lifeHours: numeric('life_hours', { precision: 10, scale: 1, mode: 'number' }).notNull(),
    maintenanceCentsPerHour: integer('maintenance_cents_per_hour').notNull().default(0),
    kw: numeric('kw', { precision: 6, scale: 3, mode: 'number' }).notNull().default(0),
    /** Accumulated printed hours. */
    hours: numeric('hours', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
    purchasedOn: date('purchased_on'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [wsIdUnique('printer_ws_id_uq', t), index('printer_ws_name_idx').on(t.workspaceId, t.name)],
);

export const maintenanceTask = pgTable(
  'maintenance_task',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    printerId: uuid('printer_id').notNull(),
    task: text('task').notNull(),
    everyHours: numeric('every_hours', { precision: 8, scale: 1, mode: 'number' }).notNull(),
    lastHours: numeric('last_hours', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
    lastOn: date('last_on'),
    position: integer('position').notNull().default(0),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id], name: 'maintenance_task_printer_fk' }),
    index('maintenance_task_ws_printer_idx').on(t.workspaceId, t.printerId),
  ],
);
