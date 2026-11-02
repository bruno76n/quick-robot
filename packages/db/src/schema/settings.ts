import { sql } from 'drizzle-orm';
import { integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, index } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps } from './columns';
import { workspace } from './workspace';

export interface BusinessInfo {
  name: string;
  trade: string;
  phone: string;
  email: string;
  city: string;
  quoteValidDays: number;
  footer: string;
}

/** Costs of the workshop and business data for documents (Ajustes). One row per workspace. */
export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: uuid('workspace_id').primaryKey().references(() => workspace.id),
  kwhPriceCents: integer('kwh_price_cents').notNull(),
  failurePct: numeric('failure_pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  purgePct: numeric('purge_pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  minMarginPct: numeric('min_margin_pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  formulaMarginPct: numeric('formula_margin_pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  business: jsonb('business').$type<BusinessInfo>().notNull(),
  ...timestamps,
});

export const salesChannel = pgTable(
  'sales_channel',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    commissionPct: numeric('commission_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex('sales_channel_ws_key_uq').on(t.workspaceId, t.nameKey).where(sql`deleted_at is null`), index('sales_channel_ws_pos_idx').on(t.workspaceId, t.position)],
);

/** Pick lists that grow on their own: materials, colors (with hex) and brands. */
export const catalogItem = pgTable(
  'catalog_item',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    kind: text('kind', { enum: ['material', 'color', 'brand'] }).notNull(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    hex: text('hex'),
    ...timestamps,
  },
  (t) => [uniqueIndex('catalog_item_ws_kind_key_uq').on(t.workspaceId, t.kind, t.nameKey)],
);
