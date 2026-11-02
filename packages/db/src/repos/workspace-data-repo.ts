// Whole-business data for export, import, restore and "Vaciar negocio" (docs/12 §10). Every table of the business,
// parents before children; rows keep their ids and drop workspace_id (the importer sets it from ctx).
import { asc, eq, getTableColumns, getTableName, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import * as s from '../schema';
import { inWorkspace } from './scope';

/** Parents first. `membership` (accounts) is not business data and is never exported or wiped. */
export const WORKSPACE_TABLES: readonly PgTable[] = [
  s.workspaceSettings, s.salesChannel, s.catalogItem, s.file, s.filament, s.supplier, s.supply, s.spool, s.spoolMovement, s.supplyMovement,
  s.printer, s.maintenanceTask, s.expense, s.product, s.productFilament, s.productSupply, s.collection, s.collectionPart,
  s.customer, s.order, s.sale, s.lineItem, s.payment, s.stockMovement, s.printRun, s.printRunFilament, s.printQueueEntry,
];
export const tableName = (t: PgTable) => getTableName(t);
export const tableByName = new Map(WORKSPACE_TABLES.map((t) => [getTableName(t), t]));
const wsColumn = (t: PgTable) => (getTableColumns(t) as Record<string, PgColumn>).workspaceId!;

/** Column metadata to validate rows of an import: JS name → drizzle data type and whether it can be null. */
export function columnsOf(t: PgTable): Map<string, { dataType: string; notNull: boolean; hasDefault: boolean }> {
  return new Map(Object.entries(getTableColumns(t) as Record<string, PgColumn>).filter(([k]) => k !== 'workspaceId')
    .map(([k, c]) => [k, { dataType: c.dataType, notNull: c.notNull, hasDefault: c.hasDefault }]));
}

export async function dumpWorkspace(ex: Executor, ctx: Ctx): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of WORKSPACE_TABLES) {
    const cols = getTableColumns(t) as Record<string, PgColumn>;
    const order = cols.createdAt ?? cols.id ?? wsColumn(t);
    const rows = await ex.select().from(t).where(inWorkspace(wsColumn(t), ctx)).orderBy(asc(order));
    out[getTableName(t)] = rows.map((r) => { const { workspaceId: _w, ...rest } = r as Record<string, unknown>; return rest; });
  }
  return out;
}

/** Deletes every business row of the workspace, children first (inside the caller's transaction). */
export async function wipeWorkspace(ex: Executor, ctx: Ctx) {
  for (const t of [...WORKSPACE_TABLES].reverse()) {
    if (t === s.product) await ex.update(s.product).set({ parentId: null }).where(inWorkspace(s.product.workspaceId, ctx));
    await ex.delete(t).where(eq(wsColumn(t), ctx.workspaceId));
  }
}

const DEFAULT = Symbol('default');

/** Inserts the rows of each table (already validated), parents first; pieces with a parent go after their parent. */
export async function loadWorkspace(ex: Executor, ctx: Ctx, tables: Readonly<Record<string, readonly Record<string, unknown>[]>>) {
  inWorkspace(wsColumn(s.product), ctx);
  const counts: Record<string, number> = {};
  for (const t of WORKSPACE_TABLES) {
    const name = getTableName(t);
    let rows = [...(tables[name] ?? [])];
    if (t === s.product) rows = [...rows.filter((r) => !r.parentId), ...rows.filter((r) => r.parentId)];
    // One statement per chunk: the rows travel as a single JSON parameter and Postgres builds them with the table's own
    // types (json_populate_recordset). 330 000 rows load in seconds instead of minutes (docs/15 §2: ≤ 30 s).
    const cols = Object.entries(getTableColumns(t) as Record<string, PgColumn>);
    for (let i = 0; i < rows.length; i += 5000) {
      const part = rows.slice(i, i + 5000).map((r) => Object.fromEntries(cols.map(([k, c]) => {
        const v = k === 'workspaceId' ? ctx.workspaceId : r[k];
        return [c.name, v instanceof Date ? v.toISOString() : v === undefined ? (c.hasDefault ? DEFAULT : null) : v];
      })));
      if (!part.length) continue;
      if (part.some((r) => Object.values(r).includes(DEFAULT))) { await ex.insert(t).values(rows.slice(i, i + 5000).map((r) => ({ ...r, workspaceId: ctx.workspaceId })) as never); continue; }
      await ex.execute(sql`insert into ${t} select * from json_populate_recordset(null::${t}, ${JSON.stringify(part)}::json)`);
    }
    counts[name] = rows.length;
  }
  return counts;
}
