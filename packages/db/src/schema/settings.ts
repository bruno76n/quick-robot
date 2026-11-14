import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { idCol, pctCol, timestamps } from './columns';
import { workspace } from './workspace';

export interface BusinessData { name: string; trade: string; phone: string; email: string; city: string; quoteValidDays: number; footer: string }

/** Costs of the workshop and business data for documents (docs/05). One row per workspace. */
export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: uuid('workspace_id').primaryKey().references(() => workspace.id),
  kwhPriceCents: integer('kwh_price_cents').notNull(),
  failurePct: pctCol('failure_pct').notNull(),
  purgePct: pctCol('purge_pct').notNull(),
  minMarginPct: pctCol('min_margin_pct').notNull(),
  formulaMarginPct: pctCol('formula_margin_pct').notNull(),
  business: jsonb('business').$type<BusinessData>().notNull(),
  lastBackupOn: date('last_backup_on', { mode: 'string' }),
  /** Purchases with cost that form the cost per gram of a filament (docs/04 §1). */
  costAvgPurchases: integer('cost_avg_purchases').notNull().default(3),
  ...timestamps,
}, (t) => [check('workspace_settings_cost_avg', sql`${t.costAvgPurchases} between 1 and 10`)]);

export const salesChannel = pgTable('sales_channel', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  commissionPct: pctCol('commission_pct').notNull(),
  position: integer('position').notNull(),
  ...timestamps,
}, (t) => [unique('sales_channel_ws_id').on(t.workspaceId, t.id), unique('sales_channel_ws_key').on(t.workspaceId, t.nameKey), index('sales_channel_ws_pos').on(t.workspaceId, t.position)]);

/** Pick lists that grow by themselves (docs/06 §15). */
export const catalogItem = pgTable('catalog_item', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  hex: text('hex'),
  /** Brands only: weight of the empty spool, saved by weighSpool (ronda-4 §2.7). */
  spoolTareGrams: integer('spool_tare_grams'),
  ...timestamps,
}, (t) => [
  check('catalog_item_tare', sql`${t.spoolTareGrams} is null or ${t.spoolTareGrams} >= 0`),
  unique('catalog_item_ws_kind_key').on(t.workspaceId, t.kind, t.nameKey),
  check('catalog_item_kind', sql`${t.kind} in ('material', 'color', 'brand', 'customer_type', 'expense_category')`),
]);

/** Uploaded images (docs/05 › Archivos). The bytes live in the FileStore. */
export const file = pgTable('file', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  kind: text('kind').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull(),
  ...timestamps,
}, (t) => [
  unique('file_ws_id').on(t.workspaceId, t.id),
  check('file_kind', sql`${t.kind} in ('product_photo', 'customer_logo', 'print_photo')`),
  check('file_mime', sql`${t.mime} in ('image/jpeg', 'image/png', 'image/webp')`),
]);
