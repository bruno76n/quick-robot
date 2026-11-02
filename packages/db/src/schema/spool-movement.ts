import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { gramsCol, idCol } from './columns';
import { spool } from './spool';
import { workspace } from './workspace';

/** Spool ledger: rows are only inserted (docs/05 › Libros de movimientos). */
export const spoolMovement = pgTable('spool_movement', {
  id: idCol(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  spoolId: uuid('spool_id').notNull(),
  on: date('on', { mode: 'string' }).notNull(),
  kind: text('kind').notNull(),
  grams: gramsCol('grams').notNull(),
  note: text('note').notNull().default(''),
  refId: uuid('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: 'spool_movement_spool_fk', columns: [t.workspaceId, t.spoolId], foreignColumns: [spool.workspaceId, spool.id] }),
  index('spool_movement_ws_spool_on').on(t.workspaceId, t.spoolId, t.on),
  check('spool_movement_kind', sql`${t.kind} in ('purchase', 'consumption', 'failure', 'waste', 'adjustment')`),
]);
