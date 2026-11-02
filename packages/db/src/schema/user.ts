import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { pk, timestamps } from './columns';

export const user = pgTable(
  'user',
  {
    id: pk(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** Cloud only; null in local mode. */
    passwordHash: text('password_hash'),
    ...timestamps,
  },
  (t) => [uniqueIndex('user_email_uq').on(t.email)],
);
