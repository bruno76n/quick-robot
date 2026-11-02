import { pgTable, primaryKey, text, uuid, index } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { user } from './user';
import { workspace } from './workspace';

export const membership = pgTable(
  'membership',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    userId: uuid('user_id').notNull().references(() => user.id),
    role: text('role', { enum: ['owner', 'admin', 'operator'] }).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index('membership_user_idx').on(t.userId)],
);
