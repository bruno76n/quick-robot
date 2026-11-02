import { check, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idCol, timestamps } from './columns';

export const workspace = pgTable('workspace', {
  id: idCol(),
  name: text('name').notNull(),
  ...timestamps,
});

export const user = pgTable('user', {
  id: idCol(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  ...timestamps,
});

export const membership = pgTable('membership', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  userId: uuid('user_id').notNull().references(() => user.id),
  role: text('role').notNull(),
  ...timestamps,
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
  index('membership_user').on(t.userId),
  check('membership_role', sql`${t.role} in ('owner', 'admin', 'operator')`),
]);
