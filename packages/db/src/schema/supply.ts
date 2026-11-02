import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, idCol, numericNumber, timestamps } from './columns';
import { workspace } from './workspace';

export const supplier = pgTable('supplier', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  brands: text('brands').notNull().default(''),
  note: text('note').notNull().default(''),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [unique('supplier_ws_id').on(t.workspaceId, t.id), index('supplier_ws_name').on(t.workspaceId, t.name)]);

export const supply = pgTable('supply', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  unit: text('unit').notNull().default(''),
  costCents: integer('cost_cents').notNull(),
  minimum: numericNumber('minimum', { precision: 12, scale: 2 }).notNull(),
  note: text('note').notNull().default(''),
  supplierId: uuid('supplier_id'),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('supply_ws_id').on(t.workspaceId, t.id),
  index('supply_ws_key').on(t.workspaceId, t.nameKey),
  foreignKey({ name: 'supply_supplier_fk', columns: [t.workspaceId, t.supplierId], foreignColumns: [supplier.workspaceId, supplier.id] }),
]);

/** Supply ledger (docs/05): only inserted. */
export const supplyMovement = pgTable('supply_movement', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  supplyId: uuid('supply_id').notNull(),
  on: date('on', { mode: 'string' }).notNull(),
  kind: text('kind').notNull(),
  qty: numericNumber('qty', { precision: 12, scale: 2 }).notNull(),
  note: text('note').notNull().default(''),
  refId: uuid('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: 'supply_movement_supply_fk', columns: [t.workspaceId, t.supplyId], foreignColumns: [supply.workspaceId, supply.id] }),
  index('supply_movement_ws_supply_on').on(t.workspaceId, t.supplyId, t.on),
  check('supply_movement_kind', sql`${t.kind} in ('purchase', 'use', 'adjustment', 'waste')`),
]);
