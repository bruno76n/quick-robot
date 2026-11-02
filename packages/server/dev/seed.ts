// Applies the development seed through the same use cases the UI uses where they exist (spools, settings,
// channels, suppliers, supplies, products, collections) and the repositories for history (ledgers, printers'
// past maintenance, expenses). Development only.
import { expenseRepo, filamentRepo, printerRepo, supplyRepo, type Ctx, type Database } from '@app/db';
import type { Seed } from '@app/db/seed';
import { filamentKey } from '@app/core';
import { localEntitlements } from '../src/providers/local/entitlements';
import { addSpool } from '../src/usecases/add-spool';
import { createSupplier, createSupply } from '../src/usecases/supplies';
import { addChannel, ensureWorkspaceDefaults, updateSettings } from '../src/usecases/settings';
import { saveCollection, saveProduct } from '../src/usecases/products';
import type { UseCaseDeps } from '../src/usecases/deps';

export async function applySeed(database: Database, ctx: Ctx, seed: Seed, today: string): Promise<void> {
  const deps: UseCaseDeps = { database, entitlements: localEntitlements, clock: { today: () => today } };
  await database.transaction((tx) => ensureWorkspaceDefaults(tx, ctx));
  await updateSettings(deps, ctx, seed.settings);
  for (const c of seed.channels) await addChannel(deps, ctx, c);

  const spoolIds = new Map<string, string>();
  const filamentIds = new Map<string, string>();
  for (const s of seed.spools) {
    const { key, ...input } = s;
    const r = await addSpool(deps, ctx, input);
    spoolIds.set(key, r.spoolId);
    filamentIds.set(filamentKey(s.material, s.color), r.filament.id);
  }
  await database.transaction(async (tx) => {
    for (const m of seed.movements) await filamentRepo.insertMovement(tx, ctx, { spoolId: spoolIds.get(m.spoolKey)!, on: m.on, kind: m.kind, grams: m.grams, note: m.note });
  });

  const supplierIds = new Map<string, string>();
  for (const { key, ...s } of seed.suppliers) supplierIds.set(key, (await createSupplier(deps, ctx, s)).id);
  const supplyIds = new Map<string, string>();
  for (const { key, supplierKey, ...s } of seed.supplies) supplyIds.set(key, (await createSupply(deps, ctx, { ...s, supplierId: supplierKey ? supplierIds.get(supplierKey)! : null, on: today })).id);
  await database.transaction(async (tx) => {
    for (const m of seed.supplyMovements) await supplyRepo.insertMovement(tx, ctx, { supplyId: supplyIds.get(m.supplyKey)!, on: m.on, kind: m.kind, qty: m.qty, note: m.note });
  });

  const printerIds = new Map<string, string>();
  await database.transaction(async (tx) => {
    for (const { key, tasks, ...p } of seed.printers) {
      const row = await printerRepo.insert(tx, ctx, p);
      printerIds.set(key, row.id);
      let position = 0;
      for (const t of tasks) {
        const task = await printerRepo.insertTask(tx, ctx, { printerId: row.id, task: t.task, everyHours: t.everyHours, lastHours: t.lastHours, position: position++ });
        if (t.lastOn) await printerRepo.updateTask(tx, ctx, task.id, { lastOn: t.lastOn });
      }
    }
    for (const e of seed.expenses) await expenseRepo.insert(tx, ctx, { ...e, endsOn: null });
  });

  const productIds = new Map<string, string>();
  for (const p of seed.products) {
    const r = await saveProduct(deps, ctx, null, {
      name: p.name,
      parentId: p.parentKey ? productIds.get(p.parentKey)! : null,
      mode: p.mode,
      priceCents: p.priceCents,
      marginPct: null,
      printerId: printerIds.get(p.printerKey) ?? null,
      printMinutes: p.minutes,
      batchSize: p.batchSize,
      extrasCents: p.extrasCents,
      tracksStock: p.tracksStock,
      tags: p.tags,
      note: p.note,
      spec: p.spec,
      filaments: p.filaments.map((f) => ({ filamentId: filamentIds.get(seedFilamentKey(seed, f.filamentKey))!, grams: f.grams })),
      supplies: p.supplies.map((x) => ({ supplyId: supplyIds.get(x.supplyKey)!, qty: x.qty })),
    });
    productIds.set(p.key, r.id);
  }
  for (const c of seed.collections) {
    await saveCollection(deps, ctx, null, { name: c.name, priceCents: c.priceCents, extrasCents: c.extrasCents, tags: c.tags, note: c.note, parts: c.parts.map((x) => ({ productId: productIds.get(x.productKey)!, qty: x.qty })) });
  }
}

/** Filament key (material|color) of a seed filament id (f1…f7). */
function seedFilamentKey(seed: Seed, filamentId: string): string {
  const f = seed.filaments[filamentId]!;
  return filamentKey(f.material, f.color);
}
