import { date, foreignKey, index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, timestamps } from './columns';
import { spool } from './spool';
import { workspace } from './workspace';

/** Ledger: rows are only inserted. What is left in a spool = Σ grams. */
export const spoolMovement = pgTable(
  'spool_movement',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    spoolId: uuid('spool_id').notNull(),
    on: date('on').notNull(),
    kind: text('kind', { enum: ['purchase', 'consumption', 'failure', 'waste', 'adjustment'] }).notNull(),
    /** Signed grams. */
    grams: numeric('grams', { precision: 10, scale: 1, mode: 'number' }).notNull(),
    note: text('note').notNull().default(''),
    /** print_run or order that caused it. */
    refId: uuid('ref_id'),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.spoolId], foreignColumns: [spool.workspaceId, spool.id], name: 'spool_movement_spool_fk' }),
    index('spool_movement_ws_spool_on_idx').on(t.workspaceId, t.spoolId, t.on),
  ],
);
