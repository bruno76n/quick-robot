import { boolean, date, foreignKey, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, hoursCol, idCol, numericNumber, timestamps } from './columns';
import { workspace } from './workspace';

export const printer = pgTable('printer', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  costCents: integer('cost_cents').notNull(),
  lifeHours: numericNumber('life_hours', { precision: 10, scale: 2 }).notNull(),
  maintenanceCentsPerHour: integer('maintenance_cents_per_hour').notNull(),
  kw: numericNumber('kw', { precision: 6, scale: 3 }).notNull(),
  hours: hoursCol('hours').notNull().default(0),
  purchasedOn: date('purchased_on', { mode: 'string' }),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [unique('printer_ws_id').on(t.workspaceId, t.id), index('printer_ws_name').on(t.workspaceId, t.name)]);

export const maintenanceTask = pgTable('maintenance_task', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  printerId: uuid('printer_id').notNull(),
  task: text('task').notNull(),
  everyHours: hoursCol('every_hours').notNull(),
  lastHours: hoursCol('last_hours').notNull().default(0),
  lastOn: date('last_on', { mode: 'string' }),
  position: integer('position').notNull().default(0),
  ...timestamps,
}, (t) => [
  unique('maintenance_task_ws_id').on(t.workspaceId, t.id),
  foreignKey({ name: 'maintenance_task_printer_fk', columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id] }),
  index('maintenance_task_ws_printer').on(t.workspaceId, t.printerId),
]);

/** Business expenses (docs/05). Created here because "Hecho" on a maintenance task with a cost records one; the screen is phase 3. */
export const expense = pgTable('expense', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  on: date('on', { mode: 'string' }).notNull(),
  concept: text('concept').notNull(),
  category: text('category').notNull(),
  amountCents: integer('amount_cents').notNull(),
  recurring: boolean('recurring').notNull().default(false),
  endsOn: date('ends_on', { mode: 'string' }),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [unique('expense_ws_id').on(t.workspaceId, t.id), index('expense_ws_on').on(t.workspaceId, t.on)]);
