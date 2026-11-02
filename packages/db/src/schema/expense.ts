import { boolean, date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, softDelete, timestamps } from './columns';
import { workspace } from './workspace';

/** Business expense. The screen arrives in phase 3; phase 2 only writes it from completeMaintenance. */
export const expense = pgTable(
  'expense',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    on: date('on').notNull(),
    concept: text('concept').notNull(),
    category: text('category').notNull(),
    amountCents: integer('amount_cents').notNull(),
    recurring: boolean('recurring').notNull().default(false),
    endsOn: date('ends_on'),
    refId: uuid('ref_id'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index('expense_ws_on_idx').on(t.workspaceId, t.on)],
);
