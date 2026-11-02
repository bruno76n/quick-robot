import { timestamp, unique, uuid, type PgColumn } from 'drizzle-orm/pg-core';

/** created_at / updated_at on every table (docs/05). */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Soft delete for what the UI can delete ("Deshacer" = restore). */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const pk = () => uuid('id').primaryKey();

/** Target of composite FKs `(workspace_id, id)`, so children can only point to a parent of their own workspace. */
export const wsIdUnique = (name: string, t: { workspaceId: PgColumn; id: PgColumn }) => unique(name).on(t.workspaceId, t.id);
