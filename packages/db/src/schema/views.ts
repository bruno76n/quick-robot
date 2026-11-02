// Read-only views created by a hand-written migration (docs/05 › Vistas calculadas).
import { pgView, uuid } from 'drizzle-orm/pg-core';
import { gramsCol } from './columns';

/** What is left per spool (sum of its ledger), excluding deleted spools. */
export const spoolLevels = pgView('spool_levels', {
  workspaceId: uuid('workspace_id').notNull(),
  spoolId: uuid('spool_id').notNull(),
  filamentId: uuid('filament_id').notNull(),
  remainingGrams: gramsCol('remaining_grams').notNull(),
}).existing();
