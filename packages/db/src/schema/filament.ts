import { pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps } from './columns';
import { workspace } from './workspace';

/** Filament = material + color. Unique per workspace regardless of case/accents (name_key, computed with core). */
export const filament = pgTable(
  'filament',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    material: text('material').notNull(),
    color: text('color').notNull(),
    hex: text('hex').notNull(),
    /** core.filamentKey(material, color): lower case, no accents, single spaces. */
    nameKey: text('name_key').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('filament_ws_key_uq').on(t.workspaceId, t.nameKey),
    // Target of composite FKs, so children can only point to a filament of their own workspace.
    unique('filament_ws_id_uq').on(t.workspaceId, t.id),
  ],
);
