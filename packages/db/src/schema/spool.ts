import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, gramsCol, idCol, timestamps } from './columns';
import { filament } from './filament';
import { supplier } from './supply';
import { workspace } from './workspace';

/** One spool = one purchase of a filament (docs/05). Its number (#1, #2…) is per workspace and never reused (ronda-4 §2.4). */
export const spool = pgTable('spool', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  number: integer('number').notNull(),
  filamentId: uuid('filament_id').notNull(),
  brand: text('brand').notNull().default(''),
  costCents: integer('cost_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull().default(0),
  grams: gramsCol('grams').notNull(),
  purchasedOn: date('purchased_on', { mode: 'string' }).notNull(),
  supplierId: uuid('supplier_id'),
  /** A gift or a spool included with the printer: counts in grams, not in cost (docs/04 §1). */
  noCost: boolean('no_cost').notNull().default(false),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('spool_ws_id').on(t.workspaceId, t.id),
  foreignKey({ name: 'spool_filament_fk', columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id] }),
  foreignKey({ name: 'spool_supplier_fk', columns: [t.workspaceId, t.supplierId], foreignColumns: [supplier.workspaceId, supplier.id] }),
  index('spool_ws_filament').on(t.workspaceId, t.filamentId),
  unique('spool_ws_number').on(t.workspaceId, t.number),
  check('spool_number_positive', sql`${t.number} >= 1`),
]);
