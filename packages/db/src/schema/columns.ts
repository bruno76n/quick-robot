import { timestamp, uuid } from 'drizzle-orm/pg-core';

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
