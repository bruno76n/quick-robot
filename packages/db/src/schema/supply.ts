import { sql } from 'drizzle-orm';
import { date, foreignKey, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps, wsIdUnique } from './columns';
import { supplier } from './supplier';
import { workspace } from './workspace';

/** Insumo: what is not filament but costs and runs out (rings, boxes, magnets). */
export const supply = pgTable(
  'supply',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    unit: text('unit').notNull().default('pza'),
    costCents: integer('cost_cents').notNull(),
    minimum: numeric('minimum', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
    note: text('note').notNull().default(''),
    supplierId: uuid('supplier_id'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    wsIdUnique('supply_ws_id_uq', t),
    uniqueIndex('supply_ws_key_uq').on(t.workspaceId, t.nameKey).where(sql`deleted_at is null`),
    foreignKey({ columns: [t.workspaceId, t.supplierId], foreignColumns: [supplier.workspaceId, supplier.id], name: 'supply_supplier_fk' }),
  ],
);

/** Ledger: rows are only inserted. Stock = Σ qty. */
export const supplyMovement = pgTable(
  'supply_movement',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    supplyId: uuid('supply_id').notNull(),
    on: date('on').notNull(),
    kind: text('kind', { enum: ['purchase', 'use', 'adjustment', 'waste'] }).notNull(),
    qty: numeric('qty', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    note: text('note').notNull().default(''),
    refId: uuid('ref_id'),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.supplyId], foreignColumns: [supply.workspaceId, supply.id], name: 'supply_movement_supply_fk' }),
    index('supply_movement_ws_supply_on_idx').on(t.workspaceId, t.supplyId, t.on),
  ],
);
