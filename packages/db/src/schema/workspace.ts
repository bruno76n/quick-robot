import { pgTable, text } from 'drizzle-orm/pg-core';
import { pk, timestamps } from './columns';

/** A business. Every business table carries workspace_id. */
export const workspace = pgTable('workspace', {
  id: pk(),
  name: text('name').notNull(),
  ...timestamps,
});
