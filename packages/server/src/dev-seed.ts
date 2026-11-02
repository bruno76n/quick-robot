// Development seed applied with the same use cases as the product (docs/10 §1.7). Only when the workspace is empty.
import { insertSpoolMovements, listFilaments, setWorkspaceName, transaction, type Ctx } from '@app/db';
import { loadMockupBackup, SPOOL_MOVEMENT_KIND } from '@app/db/seed';
import type { Deps } from './deps';
import { addSpool } from './usecases/add-spool';

export async function applyDevelopmentSeed(deps: Deps, ctx: Ctx, path?: string): Promise<boolean> {
  if ((await listFilaments(deps.db, ctx, { page: 1, pageSize: 1 })).total > 0) return false;
  const b = loadMockupBackup(path);
  await setWorkspaceName(deps.db, ctx, b.config.negocio.nombre);
  const spoolIds = new Map<string, string>();
  for (const r of b.rollos) {
    const f = b.filamentos.find((x) => x.id === r.fil)!;
    const out = await addSpool(deps, ctx, {
      filament: { material: f.material, color: f.color, hex: f.hex }, brand: r.marca, costCents: Math.round(r.costo * 100),
      shippingCents: Math.round(r.envio * 100), grams: r.gramos, purchasedOn: r.fecha,
    });
    spoolIds.set(r.id, out.spool.id);
  }
  // The purchase movement is created by addSpool; the rest of the ledger is copied as it is.
  const rest = b.movs.filter((m) => m.tipo !== 'compra' && spoolIds.has(m.rollo));
  await transaction(deps.db, (tx) => insertSpoolMovements(tx, ctx, rest.map((m) => ({
    id: deps.ids.next(), spoolId: spoolIds.get(m.rollo)!, on: m.fecha, kind: SPOOL_MOVEMENT_KIND[m.tipo] ?? 'adjustment', grams: m.g, note: m.nota,
  }))));
  return true;
}
