// The server (authority) gives the same numbers as the mockup for every piece and collection of the seed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { quickRobotSeed } from '@app/db/seed';
import type { Catalogue, FilamentList, SupplyList } from '@app/contract';
import golden from '../../core/test/golden/mockup-values.json';
import { applySeed } from '../dev/seed';
import { listCatalogue } from '../src/queries/catalogue';
import { listFilaments } from '../src/queries/filaments';
import { listSupplies } from '../src/queries/supplies';
import { listPrinters } from '../src/queries/printers';
import { ctxA, testDatabase } from './helpers';
import type { Database } from '@app/db';

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.01);
let database: Database;
let catalogue: Catalogue;
let filaments: FilamentList;
let supplies: SupplyList;

beforeAll(async () => {
  database = await testDatabase();
  await applySeed(database, ctxA, quickRobotSeed('2026-11-02'), '2026-11-02');
  [catalogue, filaments, supplies] = await Promise.all([listCatalogue(database.db, ctxA), listFilaments(database.db, ctxA), listSupplies(database.db, ctxA)]);
});
afterAll(() => database.close());

describe('server vs mockup (golden)', () => {
  it('same filament cost per gram', () => {
    for (const g of golden.filaments) near(filaments.items.find((f) => f.material === g.material && f.color === g.color)!.costPerGram, g.costPerGram);
  });

  it.each(golden.products.map((p) => [p.input.nombre, p] as const))('piece %s', (name, g) => {
    const p = catalogue.products.find((x) => x.name === name)!;
    expect(p).toBeDefined();
    near(p.costing.M, g.expected.M);
    near(p.costing.L, g.expected.L);
    near(p.costing.Q, g.expected.Q);
    near(p.costing.E, g.expected.E);
    near(p.costing.F, g.expected.F);
    near(p.costing.total, g.expected.cost);
    near(p.costing.listPrice, g.expected.listPrice);
    near(p.costing.floor, g.expected.floor);
    near(p.costing.suggested, g.expected.suggested);
  });

  it.each(golden.collections.map((c) => [c.input.nombre, c] as const))('collection %s', (name, g) => {
    const c = catalogue.collections.find((x) => x.name === name)!;
    near(c.costing.loose, g.expected.loose);
    near(c.costing.price, g.expected.price);
    near(c.costing.cost, g.expected.cost);
  });

  it('same supply stock (including what the print history spent)', () => {
    for (const g of golden.supplies) near(supplies.items.find((s) => s.name === g.nombre)!.stock, g.stock);
  });

  it('printers and maintenance from the seed', async () => {
    const pl = await listPrinters(database.db, ctxA);
    expect(pl.items.map((p) => p.name)).toEqual(['Bambu Lab P1S', 'Ender 3 V3 SE']);
    const p1 = pl.items[0]!;
    near(p1.machinePerHour, 12000 / 5000 + 0.6);
    expect(p1.tasks.map((t) => t.status)).toEqual(['ok', 'due', 'ok']);
  });
});
