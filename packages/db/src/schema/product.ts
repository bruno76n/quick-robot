import { boolean, foreignKey, index, integer, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps, wsIdUnique } from './columns';
import { filament } from './filament';
import { supply } from './supply';
import { workspace } from './workspace';

export interface PrintSpec {
  layer?: string;
  infill?: string;
  walls?: string;
  supports?: string;
  nozzle?: string;
  bed?: string;
  file?: string;
  note?: string;
}

/** A piece of the catalog. Variants are products with parent_id. Cost is never stored: it is computed. */
export const product = pgTable(
  'product',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    mode: text('mode', { enum: ['value', 'formula'] }).notNull().default('value'),
    priceCents: integer('price_cents').notNull().default(0),
    marginPct: numeric('margin_pct', { precision: 5, scale: 2, mode: 'number' }),
    /** null = average of the printers ("cualquiera"). */
    printerId: uuid('printer_id'),
    /** Print time in whole minutes (h + min in the form). */
    printMinutes: integer('print_minutes').notNull().default(0),
    batchSize: integer('batch_size').notNull().default(1),
    extrasCents: integer('extras_cents').notNull().default(0),
    tracksStock: boolean('tracks_stock').notNull().default(false),
    tags: text('tags').array().notNull().default([]),
    note: text('note').notNull().default(''),
    spec: jsonb('spec').$type<PrintSpec>(),
    photoFileId: uuid('photo_file_id'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [wsIdUnique('product_ws_id_uq', t), index('product_ws_name_idx').on(t.workspaceId, t.name)],
);

export const productFilament = pgTable(
  'product_filament',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    productId: uuid('product_id').notNull(),
    filamentId: uuid('filament_id').notNull(),
    grams: numeric('grams', { precision: 10, scale: 1, mode: 'number' }).notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id], name: 'product_filament_product_fk' }),
    foreignKey({ columns: [t.workspaceId, t.filamentId], foreignColumns: [filament.workspaceId, filament.id], name: 'product_filament_filament_fk' }),
    index('product_filament_ws_product_idx').on(t.workspaceId, t.productId),
  ],
);

export const productSupply = pgTable(
  'product_supply',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    productId: uuid('product_id').notNull(),
    supplyId: uuid('supply_id').notNull(),
    qty: numeric('qty', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id], name: 'product_supply_product_fk' }),
    foreignKey({ columns: [t.workspaceId, t.supplyId], foreignColumns: [supply.workspaceId, supply.id], name: 'product_supply_supply_fk' }),
    index('product_supply_ws_product_idx').on(t.workspaceId, t.productId),
  ],
);
