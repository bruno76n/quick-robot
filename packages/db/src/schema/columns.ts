// Shared column helpers (docs/05 › Reglas generales).
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/** numeric(p, s) read back as a JS number (grams, hours, percentages). */
export const numericNumber = customType<{ data: number; driverData: string; config: { precision: number; scale: number } }>({
  dataType: (c) => `numeric(${c?.precision ?? 10}, ${c?.scale ?? 1})`,
  fromDriver: (v) => Number(v),
  toDriver: (v) => String(v),
});

export const gramsCol = (name: string) => numericNumber(name, { precision: 10, scale: 1 });
export const hoursCol = (name: string) => numericNumber(name, { precision: 8, scale: 2 });
export const pctCol = (name: string) => numericNumber(name, { precision: 5, scale: 2 });

export const idCol = () => uuid('id').primaryKey();
export const workspaceIdCol = () => uuid('workspace_id').notNull();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const deletedAt = () => timestamp('deleted_at', { withTimezone: true });
