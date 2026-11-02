import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { pk, timestamps, wsIdUnique } from './columns';
import { workspace } from './workspace';

/** Uploaded file kept by the FileStore (disk locally, object storage in the cloud). */
export const file = pgTable(
  'file',
  {
    id: pk(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
    kind: text('kind').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    ...timestamps,
  },
  (t) => [wsIdUnique('file_ws_id_uq', t)],
);
