import { date, foreignKey, index, integer, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps } from './columns';
import { filament } from './filament';
import { workspace } from './workspace';

/** A spool = one purchase of a filament, any brand. */
export const spool = pgTable(
  'spool',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    filamentId: uuid('filament_id').notNull(),
    brand: text('brand').notNull().default(''),
    costCents: integer('cost_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    grams: numeric('grams', { precision: 10, scale: 1, mode: 'number' }).notNull(),
    purchasedOn: date('purchased_on').notNull(),
    /** FK to supplier is added when the supplier table exists (phase 2). */
    supplierId: uuid('supplier_id'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id], name: 'spool_filament_fk' }),
    unique('spool_ws_id_uq').on(t.workspaceId, t.id),
    index('spool_ws_filament_idx').on(t.workspaceId, t.filamentId),
  ],
);
