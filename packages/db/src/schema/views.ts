// Read-only views created by a hand-written migration (docs/05 › Vistas calculadas).
import { pgView, uuid } from 'drizzle-orm/pg-core';
import { gramsCol, numericNumber } from './columns';

/** What is left per spool (sum of its ledger), excluding deleted spools. */
export const spoolLevels = pgView('spool_levels', {
  workspaceId: uuid('workspace_id').notNull(),
  spoolId: uuid('spool_id').notNull(),
  filamentId: uuid('filament_id').notNull(),
  remainingGrams: gramsCol('remaining_grams').notNull(),
}).existing();

/** Stock per supply (sum of its ledger), excluding deleted supplies. */
export const supplyLevels = pgView('supply_levels', {
  workspaceId: uuid('workspace_id').notNull(),
  supplyId: uuid('supply_id').notNull(),
  stock: numericNumber('stock', { precision: 14, scale: 2 }).notNull(),
}).existing();

/** Physical pieces per product (sum of its ledger), excluding deleted products. Reserved comes from orders (docs/04 §5). */
export const stockLevels = pgView('stock_levels', {
  workspaceId: uuid('workspace_id').notNull(),
  productId: uuid('product_id').notNull(),
  physical: numericNumber('physical', { precision: 14, scale: 0 }).notNull(),
}).existing();
