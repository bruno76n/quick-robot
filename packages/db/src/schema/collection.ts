import { foreignKey, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps, wsIdUnique } from './columns';
import { product } from './product';
import { workspace } from './workspace';

/** A set of existing pieces sold together. Empty price = sum of the loose pieces. */
export const collection = pgTable(
  'collection',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    priceCents: integer('price_cents'),
    extrasCents: integer('extras_cents').notNull().default(0),
    tags: text('tags').array().notNull().default([]),
    note: text('note').notNull().default(''),
    ...timestamps,
    ...softDelete,
  },
  (t) => [wsIdUnique('collection_ws_id_uq', t), index('collection_ws_name_idx').on(t.workspaceId, t.name)],
);

export const collectionPart = pgTable(
  'collection_part',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    collectionId: uuid('collection_id').notNull(),
    productId: uuid('product_id').notNull(),
    qty: integer('qty').notNull().default(1),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.collectionId], foreignColumns: [collection.workspaceId, collection.id], name: 'collection_part_collection_fk' }),
    foreignKey({ columns: [t.workspaceId, t.productId], foreignColumns: [product.workspaceId, product.id], name: 'collection_part_product_fk' }),
    index('collection_part_ws_collection_idx').on(t.workspaceId, t.collectionId),
  ],
);
