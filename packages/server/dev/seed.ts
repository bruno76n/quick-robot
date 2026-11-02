// Applies the development seed through the same use case the UI uses (addSpool) plus ledger movements.
import { filamentRepo, type Ctx, type Database } from '@app/db';
import type { Seed } from '@app/db/seed';
import { localEntitlements } from '../src/providers/local/entitlements';
import { addSpool } from '../src/usecases/add-spool';

export async function applySeed(database: Database, ctx: Ctx, seed: Seed): Promise<void> {
  const spoolIds = new Map<string, string>();
  for (const s of seed.spools) {
    const { key, ...input } = s;
    const r = await addSpool({ database, entitlements: localEntitlements }, ctx, input);
    spoolIds.set(key, r.spoolId);
  }
  await database.transaction(async (tx) => {
    for (const m of seed.movements) {
      await filamentRepo.insertMovement(tx, ctx, { spoolId: spoolIds.get(m.spoolKey)!, on: m.on, kind: m.kind, grams: m.grams, note: m.note });
    }
  });
}
