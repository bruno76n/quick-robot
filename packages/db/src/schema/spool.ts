import { date, foreignKey, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, gramsCol, idCol, timestamps } from './columns';
import { filament } from './filament';
import { workspace } from './workspace';

/** One spool = one purchase of a filament (docs/05). */
export const spool = pgTable('spool', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  filamentId: uuid('filament_id').notNull(),
  brand: text('brand').notNull().default(''),
  costCents: integer('cost_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull().default(0),
  grams: gramsCol('grams').notNull(),
  purchasedOn: date('purchased_on', { mode: 'string' }).notNull(),
  supplierId: uuid('supplier_id'),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('spool_ws_id').on(t.workspaceId, t.id),
  foreignKey({ name: 'spool_filament_fk', columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id] }),
  index('spool_ws_filament').on(t.workspaceId, t.filamentId),
]);
