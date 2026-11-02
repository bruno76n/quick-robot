// Two workspaces with look-alike data (docs/14 §3) for isolation tests.
import type { Ctx } from '../src/ctx';
import type { Db } from '../src/db';
import { ensureWorkspace } from '../src/repos/workspace-repo';
import { insertFilament, insertSpool, insertSpoolMovements } from '../src/repos/filament-repo';

let seq = 0;
export const uid = (tag: number) => `0190${tag.toString(16).padStart(4, '0')}-0000-7000-8000-${(++seq).toString(16).padStart(12, '0')}`;

export interface WsData { ctx: Ctx; filamentId: string; spoolId: string; movementId: string }

export async function aWorkspace(db: Db, tag: number, name: string): Promise<WsData> {
  const ctx = { workspaceId: uid(tag), userId: uid(tag) };
  await ensureWorkspace(db, ctx, { name, email: `${ctx.userId}@example.test`, userName: name });
  const f = await insertFilament(db, ctx, { id: uid(tag), material: 'PLA', color: 'Negro', hex: '#121214', nameKey: 'pla|negro' });
  const s = await insertSpool(db, ctx, { id: uid(tag), filamentId: f.id, brand: 'Bambu', costCents: 45000, shippingCents: 5000, grams: 1000, purchasedOn: '2026-10-01' });
  const [m] = await insertSpoolMovements(db, ctx, [{ id: uid(tag), spoolId: s.id, on: '2026-10-01', kind: 'purchase', grams: 1000, note: '' }]);
  return { ctx, filamentId: f.id, spoolId: s.id, movementId: m!.id };
}

export async function twoWorkspaces(db: Db) {
  return { A: await aWorkspace(db, 0xa, 'Negocio A'), B: await aWorkspace(db, 0xb, 'Negocio B') };
}
