// Throwaway spike schema: a reduced slice of docs/05 (workspace, product, sale, line_item, spool_movement).
import { pgTable, uuid, text, integer, date, timestamp, numeric, index } from 'drizzle-orm/pg-core';

export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const product = pgTable(
  'product',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
  },
  (t) => [index('product_ws_idx').on(t.workspaceId, t.name)],
);

export const sale = pgTable(
  'sale',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    on: date('on').notNull(),
    channel: text('channel').notNull(),
  },
  (t) => [index('sale_ws_on_idx').on(t.workspaceId, t.on)],
);

export const lineItem = pgTable(
  'line_item',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    saleId: uuid('sale_id').notNull().references(() => sale.id),
    productId: uuid('product_id').notNull().references(() => product.id),
    qty: integer('qty').notNull(),
    priceCents: integer('price_cents').notNull(),
    costCents: integer('cost_cents').notNull(),
  },
  (t) => [index('line_item_ws_sale_idx').on(t.workspaceId, t.saleId)],
);

export const spoolMovement = pgTable(
  'spool_movement',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    spoolId: uuid('spool_id').notNull(),
    on: date('on').notNull(),
    kind: text('kind').notNull(),
    grams: numeric('grams', { precision: 10, scale: 1 }).notNull(),
    seq: integer('seq').notNull(),
  },
  (t) => [index('spool_movement_ws_idx').on(t.workspaceId, t.spoolId, t.on)],
);
