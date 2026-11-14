import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { idCol, timestamps } from './columns';
import { workspace } from './workspace';

export const filament = pgTable('filament', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  material: text('material').notNull(),
  color: text('color').notNull(),
  hex: text('hex').notNull(),
  /** core.filamentKey(material, color): one filament per material + color, ignoring case and spacing. */
  nameKey: text('name_key').notNull(),
  /** Reference price per kg, for the cost when it only has no-cost spools (docs/04 §1). */
  referenceCentsPerKg: integer('reference_cents_per_kg'),
  ...timestamps,
}, (t) => [
  unique('filament_ws_id').on(t.workspaceId, t.id),
  unique('filament_ws_key').on(t.workspaceId, t.nameKey),
  index('filament_ws_material').on(t.workspaceId, t.material, t.color),
  check('filament_reference_positive', sql`${t.referenceCentsPerKg} is null or ${t.referenceCentsPerKg} > 0`),
]);
