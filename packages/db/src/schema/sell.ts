// Stock, customers, sales, orders and production (docs/05 › Existencias, Clientes, ventas y pedidos, Producción).
import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, gramsCol, hoursCol, idCol, numericNumber, timestamps } from './columns';
import { filament } from './filament';
import { printer } from './printer';
import { collection, product } from './product';
import { file, salesChannel } from './settings';
import { workspace } from './workspace';

/** Finished-pieces ledger: rows are only inserted (docs/04 §5). */
export const stockMovement = pgTable('stock_movement', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  productId: uuid('product_id').notNull(),
  on: date('on', { mode: 'string' }).notNull(),
  kind: text('kind').notNull(),
  qty: integer('qty').notNull(),
  note: text('note').notNull().default(''),
  refId: uuid('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: 'stock_movement_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  index('stock_movement_ws_product_on').on(t.workspaceId, t.productId, t.on),
  index('stock_movement_ws_ref').on(t.workspaceId, t.refId),
  check('stock_movement_kind', sql`${t.kind} in ('initial', 'print', 'order_print', 'sale', 'return', 'delivery', 'adjustment')`),
]);

export const customer = pgTable('customer', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  type: text('type').notNull(),
  phone: text('phone').notNull().default(''),
  hasLogo: boolean('has_logo').notNull().default(false),
  logoFileId: uuid('logo_file_id'),
  note: text('note').notNull().default(''),
  createdOn: date('created_on', { mode: 'string' }).notNull(),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('customer_ws_id').on(t.workspaceId, t.id),
  index('customer_ws_key').on(t.workspaceId, t.nameKey),
  foreignKey({ name: 'customer_logo_fk', columns: [t.workspaceId, t.logoFileId], foreignColumns: [file.workspaceId, file.id] }),
]);

export interface Cancellation { on: string; reason: string; refundCents: number }
export interface SaleReturnData { on: string; restock: boolean; refundCents: number; note: string }

export const order = pgTable('order', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  number: integer('number').notNull(),
  customerId: uuid('customer_id').notNull(),
  status: text('status').notNull(),
  channelId: uuid('channel_id').notNull(),
  note: text('note').notNull().default(''),
  createdOn: date('created_on', { mode: 'string' }).notNull(),
  dueOn: date('due_on', { mode: 'string' }).notNull(),
  productionOn: date('production_on', { mode: 'string' }),
  readyOn: date('ready_on', { mode: 'string' }),
  deliveredOn: date('delivered_on', { mode: 'string' }),
  filamentDeducted: boolean('filament_deducted').notNull().default(false),
  runsLogged: boolean('runs_logged').notNull().default(false),
  stockReserved: jsonb('stock_reserved').$type<Record<string, number> | null>(),
  cancellation: jsonb('cancellation').$type<Cancellation | null>(),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('order_ws_id').on(t.workspaceId, t.id),
  unique('order_ws_number').on(t.workspaceId, t.number),
  index('order_ws_status_due').on(t.workspaceId, t.status, t.dueOn),
  foreignKey({ name: 'order_customer_fk', columns: [t.workspaceId, t.customerId], foreignColumns: [customer.workspaceId, customer.id] }),
  foreignKey({ name: 'order_channel_fk', columns: [t.workspaceId, t.channelId], foreignColumns: [salesChannel.workspaceId, salesChannel.id] }),
  check('order_status', sql`${t.status} in ('quoted', 'accepted', 'in_production', 'ready', 'delivered', 'cancelled')`),
]);

export const sale = pgTable('sale', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  on: date('on', { mode: 'string' }).notNull(),
  channelId: uuid('channel_id').notNull(),
  customerId: uuid('customer_id'),
  orderId: uuid('order_id'),
  note: text('note').notNull().default(''),
  /** false = no payment list: the sale counts as fully paid (docs/04 §6). */
  tracksPayments: boolean('tracks_payments').notNull().default(false),
  return: jsonb('return').$type<SaleReturnData | null>(),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('sale_ws_id').on(t.workspaceId, t.id),
  index('sale_ws_on').on(t.workspaceId, t.on),
  index('sale_ws_customer').on(t.workspaceId, t.customerId),
  foreignKey({ name: 'sale_channel_fk', columns: [t.workspaceId, t.channelId], foreignColumns: [salesChannel.workspaceId, salesChannel.id] }),
  foreignKey({ name: 'sale_customer_fk', columns: [t.workspaceId, t.customerId], foreignColumns: [customer.workspaceId, customer.id] }),
  foreignKey({ name: 'sale_order_fk', columns: [t.workspaceId, t.orderId], foreignColumns: [order.workspaceId, order.id] }),
]);

export interface FrozenPart { productId: string; name: string; qty: number; listCents: number; costCents: number }

export const lineItem = pgTable('line_item', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  parentKind: text('parent_kind').notNull(),
  parentId: uuid('parent_id').notNull(),
  position: integer('position').notNull().default(0),
  kind: text('kind').notNull(),
  productId: uuid('product_id'),
  collectionId: uuid('collection_id'),
  name: text('name').notNull(),
  qty: integer('qty').notNull(),
  priceCents: integer('price_cents').notNull(),
  listCents: integer('list_cents').notNull(),
  /** Unit cost with full precision (in cents, fractional) so totals match the mockup (docs/04 › convenciones). */
  costCents: numericNumber('cost_cents', { precision: 14, scale: 4 }).notNull(),
  extrasCents: integer('extras_cents').notNull().default(0),
  parts: jsonb('parts').$type<FrozenPart[] | null>(),
  printerId: uuid('printer_id'),
  fromStock: jsonb('from_stock').$type<Record<string, number> | null>(),
  ...timestamps,
}, (t) => [
  unique('line_item_ws_id').on(t.workspaceId, t.id),
  index('line_item_ws_parent').on(t.workspaceId, t.parentKind, t.parentId),
  foreignKey({ name: 'line_item_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  foreignKey({ name: 'line_item_collection_fk', columns: [t.workspaceId, t.collectionId], foreignColumns: [collection.workspaceId, collection.id] }),
  foreignKey({ name: 'line_item_printer_fk', columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id] }),
  check('line_item_parent_kind', sql`${t.parentKind} in ('order', 'sale')`),
  check('line_item_kind', sql`${t.kind} in ('piece', 'set')`),
]);

export const payment = pgTable('payment', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  parentKind: text('parent_kind').notNull(),
  parentId: uuid('parent_id').notNull(),
  on: date('on', { mode: 'string' }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  note: text('note').notNull().default(''),
  ...timestamps,
}, (t) => [
  unique('payment_ws_id').on(t.workspaceId, t.id),
  index('payment_ws_parent').on(t.workspaceId, t.parentKind, t.parentId),
  check('payment_parent_kind', sql`${t.parentKind} in ('order', 'sale')`),
]);

export const printRun = pgTable('print_run', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  on: date('on', { mode: 'string' }).notNull(),
  productId: uuid('product_id'),
  qty: integer('qty').notNull(),
  printerId: uuid('printer_id'),
  result: text('result').notNull(),
  hours: hoursCol('hours').notNull(),
  reason: text('reason').notNull(),
  text: text('text').notNull().default(''),
  orderId: uuid('order_id'),
  photoFileId: uuid('photo_file_id'),
  ...timestamps,
}, (t) => [
  unique('print_run_ws_id').on(t.workspaceId, t.id),
  index('print_run_ws_on').on(t.workspaceId, t.on),
  foreignKey({ name: 'print_run_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  foreignKey({ name: 'print_run_printer_fk', columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id] }),
  foreignKey({ name: 'print_run_order_fk', columns: [t.workspaceId, t.orderId], foreignColumns: [order.workspaceId, order.id] }),
  foreignKey({ name: 'print_run_photo_fk', columns: [t.workspaceId, t.photoFileId], foreignColumns: [file.workspaceId, file.id] }),
  check('print_run_result', sql`${t.result} in ('ok', 'fail')`),
  check('print_run_reason', sql`${t.reason} in ('stock', 'order', 'test')`),
]);

export const printRunFilament = pgTable('print_run_filament', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  printRunId: uuid('print_run_id').notNull(),
  filamentId: uuid('filament_id').notNull(),
  grams: gramsCol('grams').notNull(),
}, (t) => [
  foreignKey({ name: 'print_run_filament_run_fk', columns: [t.workspaceId, t.printRunId], foreignColumns: [printRun.workspaceId, printRun.id] }),
  foreignKey({ name: 'print_run_filament_filament_fk', columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id] }),
  index('print_run_filament_ws_run').on(t.workspaceId, t.printRunId),
]);

/** One entry per printer and order while it is in production (docs/04 §7). */
export const printQueueEntry = pgTable('print_queue_entry', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  printerId: uuid('printer_id').notNull(),
  orderId: uuid('order_id').notNull(),
  text: text('text').notNull(),
  minutes: integer('minutes').notNull(),
  position: integer('position').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  unique('print_queue_entry_ws_id').on(t.workspaceId, t.id),
  index('print_queue_entry_ws_printer').on(t.workspaceId, t.printerId, t.position),
  foreignKey({ name: 'print_queue_entry_printer_fk', columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id] }),
  foreignKey({ name: 'print_queue_entry_order_fk', columns: [t.workspaceId, t.orderId], foreignColumns: [order.workspaceId, order.id] }),
]);
