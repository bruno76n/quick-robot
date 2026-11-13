// Migration 0007 on old data (informe-ronda2-a §4.3): apply 0000–0006, seed the rare cases, apply 0007.
// Chains go to the root, orphans stand alone, labels come from names, and no name changes. The SQL label rule is
// checked against core › variantLabelFromName (parity).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeParents, variantLabelFromName } from '../../core/src/variants';
import { VARIANT_NAME_CASES } from '../../core/test/fixtures/variant-names';
import { connectPglite, DEFAULT_MIGRATIONS, type Connection } from '../src/connect';

const MIGRATION = readFileSync(join(DEFAULT_MIGRATIONS, '0007_variant_label.sql'), 'utf8');
const tmp: string[] = [];
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });

function migrationsUpTo6() {
  const out = mkdtempSync(join(tmpdir(), 'mig06-'));
  tmp.push(out);
  cpSync(DEFAULT_MIGRATIONS, out, { recursive: true });
  const path = join(out, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(path, 'utf8')) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((e) => e.tag < '0007');
  rmSync(join(out, '0007_variant_label.sql'));
  writeFileSync(path, JSON.stringify(journal));
  return out;
}

const rows = async <T>(c: Connection, q: ReturnType<typeof sql>) => ((await c.db.execute(q)) as unknown as { rows: T[] }).rows;
const WS = ['0190aaaa-0000-7000-8000-00000000000a', '0190bbbb-0000-7000-8000-00000000000b'] as const;
let n = 0;
const id = (ws: number) => `0190${ws ? 'bbbb' : 'aaaa'}-0000-7000-8000-${(++n).toString(16).padStart(12, '0')}`;

interface Seed { key: string; ws: number; name: string; parent?: string; deleted?: boolean }
// Each piece of §4.3 by key; parents refer to keys of the same workspace.
const SEED: Seed[] = [
  // 1: chains of 2 and 3 levels
  { key: 'root', ws: 0, name: 'Llavero Bambu' },
  { key: 'v1', ws: 0, name: 'Llavero Bambu (variante)', parent: 'root' },
  { key: 'v2', ws: 0, name: 'Llavero Bambu (variante) (variante)', parent: 'v1' },
  { key: 'v3', ws: 0, name: 'Llavero Bambu – azul', parent: 'v2' },
  // 2: original deleted → independent; 3: root deleted, live middle link becomes the original
  { key: 'gone', ws: 0, name: 'Maceta geo', deleted: true },
  { key: 'orphan', ws: 0, name: 'Maceta geo (variante)', parent: 'gone' },
  { key: 'child', ws: 0, name: 'Maceta geo (variante) negro', parent: 'orphan' },
  // 5 and 7: text of its own in parentheses, "·" inside the original
  { key: 'spider', ws: 0, name: 'Spider-Man · salto' },
  { key: 'silk', ws: 0, name: 'Spider-Man · salto (silk morado)', parent: 'spider' },
  { key: 'dot', ws: 0, name: 'Spider-Man · salto · rojo', parent: 'spider' },
  // 6: does not start with the original
  { key: 'other', ws: 0, name: 'Hombre araña azul (variante)', parent: 'spider' },
  // 8: case and accents
  { key: 'cafe', ws: 0, name: 'Cafe Oscuro' },
  { key: 'cafe2', ws: 0, name: 'CAFÉ  oscuro: Mate', parent: 'cafe' },
  // 9: longer than 60
  { key: 'long', ws: 0, name: `Cafe Oscuro ${'x'.repeat(70)}`, parent: 'cafe' },
  // 10: two variants with the same label; 11: a deleted variant of a live original
  { key: 'same1', ws: 0, name: 'Cafe Oscuro (variante)', parent: 'cafe' },
  { key: 'same2', ws: 0, name: 'Cafe Oscuro (variante)', parent: 'cafe' },
  { key: 'delvar', ws: 0, name: 'Cafe Oscuro (dorado)', parent: 'cafe', deleted: true },
  // 12: another business with the same names and a different shape
  { key: 'b-root', ws: 1, name: 'Llavero Bambu', deleted: true },
  { key: 'b-v1', ws: 1, name: 'Llavero Bambu (variante)', parent: 'b-root' },
  { key: 'b-spider', ws: 1, name: 'Spider-Man · salto' },
  { key: 'b-silk', ws: 1, name: 'Spider-Man · salto (silk morado)', parent: 'b-spider' },
];

describe('migration 0007 · variants to the root with labels', () => {
  let c: Connection;
  const ids = new Map<string, string>();
  let before: Map<string, { name: string; deleted_at: string | null }>;

  beforeAll(async () => {
    const data = mkdtempSync(join(tmpdir(), 'mig07-'));
    tmp.push(data);
    const old = await connectPglite({ dataDir: data, migrationsFolder: migrationsUpTo6() });
    for (const [i, ws] of WS.entries()) await old.db.execute(sql`insert into workspace (id, name) values (${ws}, ${`Negocio ${i}`})`);
    for (const s of SEED) ids.set(s.key, id(s.ws));
    for (const s of SEED) {
      await old.db.execute(sql`insert into product (id, workspace_id, name, parent_id, mode, hours, deleted_at)
        values (${ids.get(s.key)!}, ${WS[s.ws]!}, ${s.name}, ${s.parent ? ids.get(s.parent)! : null}, 'value', 1, ${s.deleted ? new Date('2026-11-01T00:00:00Z').toISOString() : null})`);
    }
    before = new Map((await rows<{ id: string; name: string; deleted_at: string | null }>(old, sql`select id, name, deleted_at::text from product`)).map((r) => [r.id, r]));
    await old.close();
    c = await connectPglite({ dataDir: data });
  }, 90_000);
  afterAll(() => c?.close());

  const after = async () => new Map((await rows<{ id: string; name: string; parent_id: string | null; variant_label: string | null; deleted_at: string | null }>(c, sql`select id, name, parent_id, variant_label, deleted_at::text from product`)).map((r) => [r.id, r]));
  const piece = async (key: string) => (await after()).get(ids.get(key)!)!;
  const parentKey = async (key: string) => { const p = (await piece(key)).parent_id; return p ? [...ids].find(([, v]) => v === p)![0] : null; };

  it('case 1: chains of 2 and 3 levels point to the root', async () => {
    expect([await parentKey('v1'), await parentKey('v2'), await parentKey('v3')]).toEqual(['root', 'root', 'root']);
    expect([(await piece('v1')).variant_label, (await piece('v2')).variant_label, (await piece('v3')).variant_label]).toEqual(['Variante', 'Variante', 'azul']);
  });
  it('case 2: a variant whose original is deleted becomes an independent piece without label', async () => {
    expect(await parentKey('orphan')).toBeNull();
    expect((await piece('orphan')).variant_label).toBeNull();
  });
  it('case 3: root deleted, the live middle link becomes the original', async () => {
    expect(await parentKey('child')).toBe('orphan');
    expect((await piece('child')).variant_label).toBe('negro');
  });
  it('case 4: only "(variante)" → Variante', async () => expect((await piece('same1')).variant_label).toBe('Variante'));
  it('case 5: own text in parentheses → silk morado', async () => expect((await piece('silk')).variant_label).toBe('silk morado'));
  it('case 6: a name that does not start with the original keeps the whole name', async () => expect((await piece('other')).variant_label).toBe('Hombre araña azul'));
  it('case 7: "·" inside the original is not split', async () => expect((await piece('dot')).variant_label).toBe('rojo'));
  it('case 8: case and accents do not matter', async () => expect((await piece('cafe2')).variant_label).toBe('Mate'));
  it('case 9: a label longer than 60 is cut', async () => expect((await piece('long')).variant_label).toBe('x'.repeat(60)));
  it('case 10: two variants may share a label', async () => {
    expect([(await piece('same1')).variant_label, (await piece('same2')).variant_label]).toEqual(['Variante', 'Variante']);
  });
  it('case 11: a deleted variant of a live original also gets its label', async () => {
    expect([await parentKey('delvar'), (await piece('delvar')).variant_label]).toEqual(['cafe', 'dorado']);
  });
  it('case 12: each business is normalized only with its own rows', async () => {
    expect([await parentKey('b-v1'), (await piece('b-v1')).variant_label]).toEqual([null, null]);
    expect([await parentKey('b-silk'), (await piece('b-silk')).variant_label]).toEqual(['b-spider', 'silk morado']);
    expect(await parentKey('silk')).toBe('spider');
  });
  it('case 13: no name nor deletion changes; originals keep no label', async () => {
    const now = await after();
    for (const [k, b] of before) expect([now.get(k)!.name, now.get(k)!.deleted_at]).toEqual([b.name, b.deleted_at]);
    expect([(await piece('root')).variant_label, (await piece('spider')).variant_label]).toEqual([null, null]);
  });
  it('the same parents as core › normalizeParents', async () => {
    for (const ws of [0, 1]) {
      const seed = SEED.filter((s) => s.ws === ws);
      const expected = normalizeParents(seed.map((s) => ({ id: s.key, parentId: s.parent ?? null, deleted: s.deleted ?? false })));
      for (const s of seed) expect([s.key, await parentKey(s.key)]).toEqual([s.key, expected.get(s.key) ?? null]);
    }
  });
  it('the check refuses a variant without a label and a label over 60', async () => {
    await expect(c.db.execute(sql`update product set variant_label = null where id = ${ids.get('silk')!}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update product set variant_label = ${'y'.repeat(61)} where id = ${ids.get('silk')!}`)).rejects.toThrow();
    await expect(c.db.execute(sql`update product set variant_label = '' where id = ${ids.get('silk')!}`)).rejects.toThrow();
  });
});

describe('migration 0007 · SQL label rule = core › variantLabelFromName', () => {
  let pg: PGlite;
  beforeAll(async () => {
    pg = await PGlite.create();
    // The temporary functions of the migration, created again in this session (they need no tables).
    await pg.exec(MIGRATION.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.startsWith('CREATE FUNCTION')).join(';\n'));
  }, 60_000);
  afterAll(() => pg?.close());

  const extra = [
    { name: 'Llavero (Variante)', original: 'Llavero' },
    { name: 'llavero:  rojo ', original: 'LLAVERO' },
    { name: 'Ñandú / dorado', original: 'Nandu' },
    { name: 'Pieza (a) (b)', original: 'Pieza' },
    { name: '  ', original: 'Pieza' },
    { name: 'Pieza — (azul)', original: 'Pieza' },
    { name: 'Piezas', original: 'Pieza' },
  ];
  it.each([...VARIANT_NAME_CASES, ...extra])('$name ← $original', async ({ name, original }) => {
    const r = await pg.query<{ label: string }>('select pg_temp.qr_variant_label($1, $2) as label', [name, original]);
    expect(r.rows[0]!.label).toBe(variantLabelFromName(name, original));
  });
});
