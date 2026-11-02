import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, gramsCol, hoursCol, idCol, numericNumber, pctCol, timestamps } from './columns';
import { filament } from './filament';
import { printer } from './printer';
import { file } from './settings';
import { supply } from './supply';
import { workspace } from './workspace';

export interface ProductSpec { layer?: string | undefined; infill?: string | undefined; walls?: string | undefined; supports?: string | undefined; nozzle?: string | undefined; bed?: string | undefined; file?: string | undefined; note?: string | undefined }

export const product = pgTable('product', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  mode: text('mode').notNull(),
  priceCents: integer('price_cents').notNull().default(0),
  marginPct: pctCol('margin_pct'),
  printerId: uuid('printer_id'),
  hours: hoursCol('hours').notNull(),
  batchSize: integer('batch_size').notNull().default(1),
  extrasCents: integer('extras_cents').notNull().default(0),
  tracksStock: boolean('tracks_stock').notNull().default(false),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  note: text('note').notNull().default(''),
  photoFileId: uuid('photo_file_id'),
  spec: jsonb('spec').$type<ProductSpec | null>(),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [
  unique('product_ws_id').on(t.workspaceId, t.id),
  index('product_ws_name').on(t.workspaceId, t.name),
  foreignKey({ name: 'product_parent_fk', columns: [t.workspaceId, t.parentId], foreignColumns: [t.workspaceId, t.id] }),
  foreignKey({ name: 'product_printer_fk', columns: [t.workspaceId, t.printerId], foreignColumns: [printer.workspaceId, printer.id] }),
  foreignKey({ name: 'product_photo_fk', columns: [t.workspaceId, t.photoFileId], foreignColumns: [file.workspaceId, file.id] }),
  check('product_mode', sql`${t.mode} in ('value', 'formula')`),
]);

export const productFilament = pgTable('product_filament', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  productId: uuid('product_id').notNull(),
  filamentId: uuid('filament_id').notNull(),
  grams: gramsCol('grams').notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [
  foreignKey({ name: 'product_filament_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  foreignKey({ name: 'product_filament_filament_fk', columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id] }),
  index('product_filament_ws_product').on(t.workspaceId, t.productId),
]);

export const productSupply = pgTable('product_supply', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  productId: uuid('product_id').notNull(),
  supplyId: uuid('supply_id').notNull(),
  qty: numericNumber('qty', { precision: 12, scale: 2 }).notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [
  foreignKey({ name: 'product_supply_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  foreignKey({ name: 'product_supply_supply_fk', columns: [t.workspaceId, t.supplyId], foreignColumns: [supply.workspaceId, supply.id] }),
  index('product_supply_ws_product').on(t.workspaceId, t.productId),
]);

export const collection = pgTable('collection', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  priceCents: integer('price_cents'),
  extrasCents: integer('extras_cents').notNull().default(0),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  note: text('note').notNull().default(''),
  ...timestamps,
  deletedAt: deletedAt(),
}, (t) => [unique('collection_ws_id').on(t.workspaceId, t.id), index('collection_ws_name').on(t.workspaceId, t.name)]);

export const collectionPart = pgTable('collection_part', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  collectionId: uuid('collection_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: integer('qty').notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [
  foreignKey({ name: 'collection_part_collection_fk', columns: [t.workspaceId, t.collectionId], foreignColumns: [collection.workspaceId, collection.id] }),
  foreignKey({ name: 'collection_part_product_fk', columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id] }),
  index('collection_part_ws_collection').on(t.workspaceId, t.collectionId),
]);
