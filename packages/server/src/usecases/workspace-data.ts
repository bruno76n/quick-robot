// Export, import (own format or the mockup's v7 backup), automatic backups, restore and "Vaciar negocio" (docs/12 §10,
// docs/05 › Importar el mockup). An import always saves a backup first and is applied in one transaction.
import { BusinessError } from '@app/contract';
import { COST_AVG_PURCHASES, numberSpools } from '@app/core';
import {
  columnsOf, dumpWorkspace, getFile, getSettings, loadWorkspace, schemaVersion, tableByName, transaction, updateSettings, wipeWorkspace,
  type Ctx, type Db,
} from '@app/db';
import type { MockupBackup } from '@app/db/seed';
import { z } from 'zod';
import type { Deps } from '../deps';
import { applyMockupBackup } from '../dev-seed';
import { uploadFile } from './files';
import { ensureWorkspaceDefaults } from './settings';
import { compareMockupSums } from './import-mockup';
import { normalizeVariants } from './variants';

export const EXPORT_FORMAT = 'workspace-export';
const ISO_TS = /^\d{4}-\d{2}-\d{2}T/;

// ---------- Export ----------
export async function exportData(deps: Deps, ctx: Ctx) {
  const tables = await dumpWorkspace(deps.db, ctx);
  const files: Record<string, string> = {};
  for (const f of (tables.file ?? []) as { id: string; storageKey: string }[]) {
    try { files[f.id] = Buffer.from(await deps.files.read(ctx, { key: f.storageKey })).toString('base64'); } catch { /* a missing file is exported without its bytes */ }
  }
  return { format: EXPORT_FORMAT, schemaVersion: schemaVersion(), appVersion: deps.version, exportedAt: deps.clock.now().toISOString(), tables, files };
}

/** "Descargar copia": the file, and lastBackupOn moves to today (Inicio stops asking for a backup). */
export async function exportWorkspace(deps: Deps, ctx: Ctx) {
  const data = await exportData(deps, ctx);
  await transaction(deps.db, (tx) => updateSettings(tx, ctx, { lastBackupOn: deps.clock.today() }));
  return data;
}

// ---------- Automatic backups ----------
export async function createBackup(deps: Deps, ctx: Ctx) {
  return deps.backups.create(ctx, new TextEncoder().encode(JSON.stringify(await exportData(deps, ctx))));
}
/** One per day: made when the app opens if today's does not exist yet (docs/12 §10, the store keeps the last 7). */
export async function ensureDailyBackup(deps: Deps, ctx: Ctx) {
  const today = deps.clock.today();
  if ((await deps.backups.list(ctx)).some((b) => b.on === today)) return null;
  if (!(await getSettings(deps.db, ctx))) return null;
  return createBackup(deps, ctx);
}

// ---------- Import ----------
const own = z.object({
  format: z.literal(EXPORT_FORMAT), schemaVersion: z.number().int().min(1), exportedAt: z.string().optional(), appVersion: z.string().optional(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))), files: z.record(z.string(), z.string()).optional(),
});
const invalid = (reason: string) => new BusinessError('IMPORT_INVALID_FILE', { reason });

/** Every row of every table is checked against the columns of the schema before anything is written (docs/11 A08). */
function validateTables(tables: Record<string, Record<string, unknown>[]>) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    const t = tableByName.get(name);
    if (!t) throw invalid(`table:${name}`);
    const cols = columnsOf(t);
    out[name] = rows.map((row, i) => {
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        const c = cols.get(k);
        if (!c) throw invalid(`column:${name}.${k}`);
        if (v === null || v === undefined) { if (c.notNull && !c.hasDefault) throw invalid(`null:${name}.${k}#${i}`); if (v === null) r[k] = null; continue; }
        const ok = c.dataType === 'string' ? typeof v === 'string' && v.length <= 1_000_000
          : c.dataType === 'number' ? typeof v === 'number' && Number.isFinite(v)
            : c.dataType === 'boolean' ? typeof v === 'boolean'
              : c.dataType === 'date' ? typeof v === 'string' && ISO_TS.test(v)
                : c.dataType === 'array' ? Array.isArray(v) && v.every((x) => typeof x === 'string')
                  : c.dataType === 'json' ? typeof v === 'object'
                    : typeof v === 'number' || typeof v === 'string';
        if (!ok) throw invalid(`type:${name}.${k}#${i}`);
        r[k] = c.dataType === 'date' ? new Date(v as string) : v;
      }
      if (cols.has('id') && (typeof r.id !== 'string' || !z.uuid().safeParse(r.id).success)) throw invalid(`id:${name}#${i}`);
      return r;
    });
  }
  return out;
}

/** Backups made before variant_label (or with chains and orphans) are normalized like migration 0007. */
function normalizeImportedProducts(rows: Record<string, unknown>[]) {
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const fixed = normalizeVariants(rows.map((r) => ({ id: r.id as string, name: str(r.name) ?? '', parentId: str(r.parentId), deleted: r.deletedAt != null, label: str(r.variantLabel) })));
  for (const r of rows) Object.assign(r, fixed.get(r.id as string));
}

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);

/**
 * Ronda 4 columns (docs/05, migration 0008). Backups made before them get spool numbers in purchase order and no-cost spools
 * where cost + shipping = 0, like the migration; values that are there must be valid (numbers ≥ 1 and not repeated, N 1–10,
 * reference > 0, tare ≥ 0), or the file is refused before anything is written.
 */
function normalizeRonda4(tables: Record<string, Record<string, unknown>[]>) {
  const spools = tables.spool ?? [];
  const seen = new Set<unknown>();
  for (const [i, r] of spools.entries()) {
    if (r.number === undefined || r.number === null) continue;
    if (!isInt(r.number) || (r.number as number) < 1 || seen.has(r.number)) throw invalid(`spool-number#${i}`);
    seen.add(r.number);
  }
  const numbers = numberSpools(spools.map((r) => ({ id: r.id as string, purchasedOn: String(r.purchasedOn ?? ''), number: r.number as number | null | undefined })));
  for (const r of spools) {
    r.number = numbers.get(r.id as string);
    if (r.noCost === undefined || r.noCost === null) r.noCost = Number(r.costCents ?? 0) + Number(r.shippingCents ?? 0) === 0;
  }
  const check = (table: string, column: string, ok: (v: number) => boolean) => {
    for (const [i, r] of (tables[table] ?? []).entries()) {
      const v = r[column];
      if (v !== undefined && v !== null && !(isInt(v) && ok(v as number))) throw invalid(`value:${table}.${column}#${i}`);
    }
  };
  check('workspace_settings', 'costAvgPurchases', (v) => v >= COST_AVG_PURCHASES.min && v <= COST_AVG_PURCHASES.max);
  check('filament', 'referenceCentsPerKg', (v) => v > 0);
  check('catalog_item', 'spoolTareGrams', (v) => v >= 0);
}

export interface ImportResult { format: 'workspace' | 'mockup-v7'; counts: Record<string, number>; differences: string[]; notes: string[]; backupId: string | null }

function parse(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw invalid('json'); }
}

export async function importWorkspace(deps: Deps, ctx: Ctx, bytes: Uint8Array, opts: { confirm: boolean; backupFirst?: boolean }): Promise<ImportResult> {
  if (!opts.confirm) throw new BusinessError('CONFIRMATION_REQUIRED');
  const raw = parse(bytes) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') throw invalid('shape');
  if (raw.format === EXPORT_FORMAT) {
    const r = own.safeParse(raw);
    if (!r.success) throw invalid('shape');
    if (r.data.schemaVersion > schemaVersion()) throw new BusinessError('IMPORT_UNSUPPORTED_VERSION', { found: String(r.data.schemaVersion), supported: String(schemaVersion()) });
    const valid = validateTables(r.data.tables);
    if (valid.product) normalizeImportedProducts(valid.product);
    normalizeRonda4(valid);
    // New ids for every row, with every reference remapped (columns and ids inside JSON: parts, fromStock, stockReserved):
    // the file can be restored in place or loaded into another business of the same database.
    const ids = new Map<string, string>();
    for (const rows of Object.values(valid)) for (const row of rows) if (typeof row.id === 'string') ids.set(row.id, deps.ids.next());
    const remap = (v: unknown): unknown => (typeof v === 'string' ? ids.get(v) ?? v : Array.isArray(v) ? v.map(remap)
      : v && typeof v === 'object' && !(v instanceof Date) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [ids.get(k) ?? k, remap(x)])) : v);
    const tables = remap(valid) as typeof valid;
    const files = Object.fromEntries(Object.entries(r.data.files ?? {}).map(([k, v]) => [ids.get(k) ?? k, v]));
    const backup = opts.backupFirst === false ? null : await createBackup(deps, ctx);
    const counts = await transaction(deps.db, async (tx) => {
      await wipeWorkspace(tx, ctx);
      for (const f of (tables.file ?? []) as { id: string; kind: string; mime: string; storageKey: string }[]) {
        const b64 = files[f.id];
        if (b64 !== undefined) f.storageKey = (await deps.files.put(ctx, { kind: f.kind as never, mime: f.mime, bytes: new Uint8Array(Buffer.from(b64, 'base64')) })).key;
      }
      return loadWorkspace(tx, ctx, tables);
    });
    return { format: 'workspace', counts, differences: [], notes: [], backupId: backup?.id ?? null };
  }
  if (typeof raw.v === 'number') {
    if (raw.v !== 7) throw new BusinessError('IMPORT_UNSUPPORTED_VERSION', { found: `v${raw.v}`, supported: 'v7' });
    return importMockup(deps, ctx, raw, opts);
  }
  throw invalid('format');
}

const mockup = z.object({
  v: z.literal(7), config: z.object({ kwh: z.number(), fallos: z.number(), purga: z.number(), margenMin: z.number(), margenFormula: z.number(), canales: z.array(z.object({ n: z.string(), c: z.number() })), negocio: z.record(z.string(), z.unknown()) }).loose(),
  cat: z.object({ materiales: z.array(z.string()), colores: z.array(z.object({ n: z.string(), hex: z.string() }).loose()), marcas: z.array(z.string()) }).loose(),
  ...Object.fromEntries(['filamentos', 'rollos', 'movs', 'proveedores', 'insumos', 'imovs', 'impresoras', 'productos', 'colecciones', 'clientes', 'pedidos', 'ventas', 'pmovs', 'imps', 'gastos']
    .map((k) => [k, z.array(z.record(z.string(), z.unknown())).max(200_000)])),
}).loose();

async function importMockup(deps: Deps, ctx: Ctx, raw: unknown, opts: { confirm: boolean; backupFirst?: boolean }): Promise<ImportResult> {
  const r = mockup.safeParse(raw);
  if (!r.success) throw invalid('mockup-shape');
  const b = r.data as unknown as MockupBackup;
  const backup = opts.backupFirst === false ? null : await createBackup(deps, ctx);
  const notes: string[] = [];
  const result = await transaction(deps.db, async (tx) => {
    await wipeWorkspace(tx, ctx);
    const d: Deps = { ...deps, db: tx as unknown as Db };
    await ensureWorkspaceDefaults(d, ctx, tx);
    const image = async (dataUrl: string, kind: 'product_photo' | 'customer_logo') => {
      const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!m) { notes.push(`image:${kind}`); return null; }
      try { return (await uploadFile(d, ctx, kind, new Uint8Array(Buffer.from(m[2]!, 'base64')))).fileId; } catch { notes.push(`image:${kind}`); return null; }
    };
    await applyMockupBackup(d, ctx, b, { image, notes });
    const copia = (b.pref as { copia?: string } | undefined)?.copia;
    if (copia && /^\d{4}-\d{2}-\d{2}/.test(copia)) await updateSettings(tx, ctx, { lastBackupOn: copia.slice(0, 10) });
    const counts = Object.fromEntries(Object.entries(await dumpWorkspace(tx, ctx)).map(([k, v]) => [k, v.length]));
    return { counts, differences: await compareMockupSums(d, tx, ctx, b) };
  });
  return { format: 'mockup-v7', ...result, notes, backupId: backup?.id ?? null };
}

// ---------- Restore and clear ----------
export async function restoreBackup(deps: Deps, ctx: Ctx, id: string, opts: { confirm: boolean }) {
  if (!opts.confirm) throw new BusinessError('CONFIRMATION_REQUIRED');
  let bytes: Uint8Array;
  try { bytes = await deps.backups.read(ctx, id); } catch { throw new BusinessError('NOT_FOUND', { entity: 'backup' }); }
  return importWorkspace(deps, ctx, bytes, { confirm: true });
}

/** "Vaciar negocio": a backup first, then an empty business with the starting values (docs/12 §10). */
export async function clearWorkspace(deps: Deps, ctx: Ctx, opts: { confirm: boolean }) {
  if (!opts.confirm) throw new BusinessError('CONFIRMATION_REQUIRED');
  const backup = await createBackup(deps, ctx);
  await transaction(deps.db, async (tx) => {
    await wipeWorkspace(tx, ctx);
    await ensureWorkspaceDefaults({ ...deps, db: tx as unknown as Db }, ctx, tx);
  });
  return { backupId: backup.id };
}

export { getFile };
