// Migration 0008 on old data (mejoras/ronda-4.md §3): apply 0000–0007, load the mockup backup and the rare cases, apply 0008.
// Numbers follow the purchase order per workspace (ties by id, deleted spools too), spools that cost nothing become no-cost
// spools, the new columns take their defaults and no gram changes.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectPglite, DEFAULT_MIGRATIONS, type Connection } from '../src/connect';

interface Backup {
  filamentos: { id: string; material: string; color: string; hex: string }[];
  rollos: { id: string; fil: string; fecha: string; gramos: number; costo: number; envio: number; marca: string }[];
  movs: { id: string; rollo: string; fecha: string; tipo: string; g: number; nota: string }[];
}
const BACKUP = JSON.parse(readFileSync(join(import.meta.dirname, '../../../reference/mockup-backup-v7.json'), 'utf8')) as Backup;

const tmp: string[] = [];
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });

function migrationsUpTo7() {
  const out = mkdtempSync(join(tmpdir(), 'mig07-'));
  tmp.push(out);
  cpSync(DEFAULT_MIGRATIONS, out, { recursive: true });
  const path = join(out, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(path, 'utf8')) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((e) => e.tag < '0008');
  rmSync(join(out, '0008_spools.sql'));
  writeFileSync(path, JSON.stringify(journal));
  return out;
}

const rows = async <T>(c: Connection, q: ReturnType<typeof sql>) => ((await c.db.execute(q)) as unknown as { rows: T[] }).rows;
const WS = { mockup: '0190cccc-0000-7000-8000-00000000000c', a: '0190aaaa-0000-7000-8000-00000000000a', b: '0190bbbb-0000-7000-8000-00000000000b', empty: '0190dddd-0000-7000-8000-00000000000d' } as const;
let n = 0;
/** Ids grow in creation order, so "ties by id" = the order in which the rows below are listed. */
const id = (prefix: string) => `0190${prefix}-0000-7000-8000-${(++n).toString(16).padStart(12, '0')}`;

interface RareSpool { key: string; ws: keyof typeof WS; on: string; cost: number; shipping: number; grams: number; deleted?: boolean }
const RARE: RareSpool[] = [
  { key: 'a-late', ws: 'a', on: '2026-10-05', cost: 30000, shipping: 0, grams: 1000 },
  { key: 'a-gift', ws: 'a', on: '2026-09-01', cost: 0, shipping: 0, grams: 1000 },
  { key: 'a-deleted', ws: 'a', on: '2026-09-15', cost: 25000, shipping: 0, grams: 1000, deleted: true },
  { key: 'a-tie1', ws: 'a', on: '2026-09-20', cost: 20000, shipping: 0, grams: 500 },
  { key: 'a-tie2', ws: 'a', on: '2026-09-20', cost: 0, shipping: 4000, grams: 500 },
  { key: 'b-second', ws: 'b', on: '2026-11-02', cost: 0, shipping: 0, grams: 250 },
  { key: 'b-first', ws: 'b', on: '2026-10-01', cost: 41000, shipping: 3000, grams: 1000 },
];

describe('migration 0008 · spool numbers, no-cost spools and the new columns', () => {
  let c: Connection;
  const spoolIds = new Map<string, string>();
  let before: Map<string, { grams: number; remaining: string; cost_cents: number; shipping_cents: number; purchased_on: string; deleted_at: string | null }>;

  beforeAll(async () => {
    const data = mkdtempSync(join(tmpdir(), 'mig08-'));
    tmp.push(data);
    const old = await connectPglite({ dataDir: data, migrationsFolder: migrationsUpTo7() });
    for (const [k, ws] of Object.entries(WS)) {
      await old.db.execute(sql`insert into workspace (id, name) values (${ws}, ${`Negocio ${k}`})`);
      await old.db.execute(sql`insert into workspace_settings (workspace_id, kwh_price_cents, failure_pct, purge_pct, min_margin_pct, formula_margin_pct, business)
        values (${ws}, 300, 5, 5, 30, 50, ${JSON.stringify({ name: k })}::jsonb)`);
    }
    await old.db.execute(sql`insert into catalog_item (id, workspace_id, kind, name, name_key) values (${id('cccc')}, ${WS.mockup}, 'brand', 'Bambu Lab', 'bambu lab')`);
    const filamentIds = new Map<string, string>();
    for (const f of BACKUP.filamentos) {
      const fid = id('cccc');
      filamentIds.set(f.id, fid);
      await old.db.execute(sql`insert into filament (id, workspace_id, material, color, hex, name_key) values (${fid}, ${WS.mockup}, ${f.material}, ${f.color}, ${f.hex}, ${`${f.id}`})`);
    }
    for (const r of BACKUP.rollos) {
      const sid = id('cccc');
      spoolIds.set(r.id, sid);
      await old.db.execute(sql`insert into spool (id, workspace_id, filament_id, brand, cost_cents, shipping_cents, grams, purchased_on)
        values (${sid}, ${WS.mockup}, ${filamentIds.get(r.fil)!}, ${r.marca}, ${Math.round(r.costo * 100)}, ${Math.round(r.envio * 100)}, ${r.gramos}, ${r.fecha})`);
    }
    for (const m of BACKUP.movs) {
      await old.db.execute(sql`insert into spool_movement (id, workspace_id, spool_id, "on", kind, grams, note)
        values (${id('cccc')}, ${WS.mockup}, ${spoolIds.get(m.rollo)!}, ${m.fecha}, ${m.tipo === 'compra' ? 'purchase' : 'consumption'}, ${m.g}, ${m.nota})`);
    }
    for (const ws of ['a', 'b'] as const) {
      const fid = id(ws === 'a' ? 'aaaa' : 'bbbb');
      filamentIds.set(ws, fid);
      await old.db.execute(sql`insert into filament (id, workspace_id, material, color, hex, name_key) values (${fid}, ${WS[ws]}, 'PLA', 'Gris', '#888888', 'pla|gris')`);
    }
    for (const r of RARE) {
      const sid = id(r.ws === 'a' ? 'aaaa' : 'bbbb');
      spoolIds.set(r.key, sid);
      await old.db.execute(sql`insert into spool (id, workspace_id, filament_id, brand, cost_cents, shipping_cents, grams, purchased_on, deleted_at)
        values (${sid}, ${WS[r.ws]}, ${filamentIds.get(r.ws)!}, '', ${r.cost}, ${r.shipping}, ${r.grams}, ${r.on}, ${r.deleted ? '2026-11-01T00:00:00Z' : null})`);
      await old.db.execute(sql`insert into spool_movement (id, workspace_id, spool_id, "on", kind, grams, note) values (${id('eeee')}, ${WS[r.ws]}, ${sid}, ${r.on}, 'purchase', ${r.grams}, '')`);
    }
    before = await snapshot(old);
    await old.close();
    c = await connectPglite({ dataDir: data });
  }, 120_000);
  afterAll(() => c?.close());

  async function snapshot(conn: Connection) {
    const r = await rows<{ id: string; grams: number; remaining: string; cost_cents: number; shipping_cents: number; purchased_on: string; deleted_at: string | null }>(conn, sql`
      select s.id, s.grams, coalesce((select sum(m.grams) from spool_movement m where m.spool_id = s.id), 0)::text as remaining,
             s.cost_cents, s.shipping_cents, s.purchased_on::text, s.deleted_at::text
      from spool s`);
    return new Map(r.map(({ id: k, ...v }) => [k, v]));
  }
  const spool = async (key: string) => (await rows<{ number: number; no_cost: boolean }>(c, sql`select number, no_cost from spool where id = ${spoolIds.get(key)!}`))[0]!;
  const numbers = async (keys: readonly string[]) => Promise.all(keys.map(async (k) => (await spool(k)).number));

  it('the mockup backup: numbers follow the purchase order (r1 and r2 the same day, by id)', async () => {
    // r1 22 sep, r2 22 sep, r4 24 sep, r5 28 sep, r6 2 oct, r7 10 oct, r3 20 oct, r8 26 oct.
    expect(await numbers(['r1', 'r2', 'r4', 'r5', 'r6', 'r7', 'r3', 'r8'])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const byDate = [...BACKUP.rollos].sort((a, b) => a.fecha.localeCompare(b.fecha) || spoolIds.get(a.id)!.localeCompare(spoolIds.get(b.id)!));
    expect(await numbers(byDate.map((r) => r.id))).toEqual(byDate.map((_, i) => i + 1));
  });

  it('the mockup backup has no spool that cost nothing: none becomes a no-cost spool', async () => {
    for (const r of BACKUP.rollos) expect((await spool(r.id)).no_cost, r.id).toBe(false);
  });

  it('no gram, price, date or deletion changes', async () => {
    const after = await snapshot(c);
    expect(after.size).toBe(before.size);
    for (const [k, v] of before) expect(after.get(k), k).toEqual(v);
  });

  it('rare cases: same date by id, a deleted spool keeps its place and number, only cost + shipping = 0 is no-cost', async () => {
    expect(await numbers(['a-gift', 'a-deleted', 'a-tie1', 'a-tie2', 'a-late'])).toEqual([1, 2, 3, 4, 5]);
    expect([(await spool('a-gift')).no_cost, (await spool('a-tie2')).no_cost, (await spool('a-tie1')).no_cost, (await spool('a-deleted')).no_cost]).toEqual([true, false, false, false]);
  });

  it('two workspaces: each numbers from 1', async () => {
    expect(await numbers(['b-first', 'b-second'])).toEqual([1, 2]);
    expect((await spool('b-second')).no_cost).toBe(true);
    const firsts = await rows<{ workspace_id: string; min: number; max: number; n: number }>(c, sql`select workspace_id, min(number)::int as min, max(number)::int as max, count(*)::int as n from spool group by workspace_id order by workspace_id`);
    for (const f of firsts) expect([f.min, f.max]).toEqual([1, f.n]);
  });

  it('new columns take their defaults: N = 3, no reference price, no tare', async () => {
    expect(await rows(c, sql`select distinct cost_avg_purchases from workspace_settings`)).toEqual([{ cost_avg_purchases: 3 }]);
    expect(await rows(c, sql`select count(*)::int as n from filament where reference_cents_per_kg is not null`)).toEqual([{ n: 0 }]);
    expect(await rows(c, sql`select count(*)::int as n from catalog_item where spool_tare_grams is not null`)).toEqual([{ n: 0 }]);
  });

  it('the database refuses a repeated number in a workspace, a number below 1 and N out of 1–10', async () => {
    const twin = id('aaaa');
    await expect(c.db.execute(sql`insert into spool (id, workspace_id, number, filament_id, cost_cents, grams, purchased_on)
      select ${twin}, workspace_id, 1, filament_id, 1, 1, '2026-11-01' from spool where id = ${spoolIds.get('a-late')!}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update spool set number = 0 where id = ${spoolIds.get('a-late')!}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update workspace_settings set cost_avg_purchases = 11 where workspace_id = ${WS.a}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update workspace_settings set cost_avg_purchases = 0 where workspace_id = ${WS.a}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update filament set reference_cents_per_kg = 0 where workspace_id = ${WS.a}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update catalog_item set spool_tare_grams = -1 where workspace_id = ${WS.mockup}`)).rejects.toThrow();
    // The same number in another workspace is fine.
    await c.db.execute(sql`update spool set number = 99 where id = ${spoolIds.get('a-late')!}`);
    await c.db.execute(sql`update spool set number = 99 where id = ${spoolIds.get('b-second')!}`);
  });
});
