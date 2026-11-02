import { pgTable, text, uuid, index } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps, wsIdUnique } from './columns';
import { workspace } from './workspace';

export const supplier = pgTable(
  'supplier',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    /** Filament brands it sells, comma separated (orders the Compras list). */
    brands: text('brands').notNull().default(''),
    note: text('note').notNull().default(''),
    ...timestamps,
    ...softDelete,
  },
  (t) => [wsIdUnique('supplier_ws_id_uq', t), index('supplier_ws_name_idx').on(t.workspaceId, t.name)],
);
