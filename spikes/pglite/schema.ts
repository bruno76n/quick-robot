// Minimal slice of docs/05 needed to measure the reports query.
import { pgTable, uuid, text, integer, date, numeric, index, timestamp, primaryKey, foreignKey } from 'drizzle-orm/pg-core';

export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
});

export const salesChannel = pgTable('sales_channel', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  id: uuid('id').notNull(),
  name: text('name').notNull(),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }).notNull(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.id] })]);

export const product = pgTable('product', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  id: uuid('id').notNull(),
  name: text('name').notNull(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.id] })]);

export const sale = pgTable('sale', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  id: uuid('id').notNull(),
  on: date('on').notNull(),
  channelId: uuid('channel_id').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.id] }),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [salesChannel.workspaceId, salesChannel.id] }),
  index('sale_ws_on').on(t.workspaceId, t.on),
]);

export const lineItem = pgTable('line_item', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  id: uuid('id').notNull(),
  parentKind: text('parent_kind').notNull(),
  parentId: uuid('parent_id').notNull(),
  productId: uuid('product_id'),
  qty: integer('qty').notNull(),
  priceCents: integer('price_cents').notNull(),
  costCents: integer('cost_cents').notNull(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.id] }),
  index('line_item_parent').on(t.workspaceId, t.parentKind, t.parentId),
]);

export const counter = pgTable('crash_row', {
  id: integer('id').primaryKey(),
  batch: integer('batch').notNull(),
  payload: text('payload').notNull(),
}, (t) => [index('crash_row_batch').on(t.batch)]);
