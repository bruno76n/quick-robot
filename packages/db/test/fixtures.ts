// Two workspaces with look-alike data (docs/14 §3) for isolation tests.
import type { Ctx } from '../src/ctx';
import type { Db } from '../src/db';
import { ensureWorkspace } from '../src/repos/workspace-repo';
import { insertFilament, insertSpool, insertSpoolMovements } from '../src/repos/filament-repo';
import { insertExpense, insertPrinter, insertTasks } from '../src/repos/printer-repo';
import { insertCollection, insertProduct, replaceCollectionParts, replaceProductParts } from '../src/repos/product-repo';
import { addCatalogItems, insertChannel, insertFile, insertSettings } from '../src/repos/settings-repo';
import { insertSupplier, insertSupply, insertSupplyMovements } from '../src/repos/supply-repo';

let seq = 0;
export const uid = (tag: number) => `0190${tag.toString(16).padStart(4, '0')}-0000-7000-8000-${(++seq).toString(16).padStart(12, '0')}`;

export interface WsData { ctx: Ctx; filamentId: string; spoolId: string; movementId: string; supplierId: string; supplyId: string; printerId: string; taskId: string; productId: string; collectionId: string; channelId: string; fileId: string }

export async function aWorkspace(db: Db, tag: number, name: string): Promise<WsData> {
  const ctx = { workspaceId: uid(tag), userId: uid(tag) };
  await ensureWorkspace(db, ctx, { name, email: `${ctx.userId}@example.test`, userName: name });
  const f = await insertFilament(db, ctx, { id: uid(tag), material: 'PLA', color: 'Negro', hex: '#121214', nameKey: 'pla|negro' });
  const s = await insertSpool(db, ctx, { id: uid(tag), number: 1, filamentId: f.id, brand: 'Bambu', costCents: 45000, shippingCents: 5000, grams: 1000, purchasedOn: '2026-10-01' });
  const [m] = await insertSpoolMovements(db, ctx, [{ id: uid(tag), spoolId: s.id, on: '2026-10-01', kind: 'purchase', grams: 1000, note: '' }]);
  await insertSettings(db, ctx, { kwhPriceCents: 300, failurePct: 5, purgePct: 5, minMarginPct: 30, formulaMarginPct: 50, business: { name, trade: '', phone: '', email: '', city: '', quoteValidDays: 7, footer: '' } });
  const ch = await insertChannel(db, ctx, { id: uid(tag), name: 'Efectivo', nameKey: 'efectivo', commissionPct: 0, position: 0 });
  await addCatalogItems(db, ctx, [{ id: uid(tag), kind: 'material', name: 'PLA', nameKey: 'pla' }]);
  const file = await insertFile(db, ctx, { id: uid(tag), kind: 'product_photo', mime: 'image/png', size: 10, storageKey: `${ctx.workspaceId}/x` });
  const sup = await insertSupplier(db, ctx, { id: uid(tag), name: 'Proveedor' });
  const supply = await insertSupply(db, ctx, { id: uid(tag), name: 'Argolla', nameKey: 'argolla', costCents: 50, minimum: 10, supplierId: sup.id });
  await insertSupplyMovements(db, ctx, [{ id: uid(tag), supplyId: supply.id, on: '2026-10-01', kind: 'purchase', qty: 100 }]);
  const pr = await insertPrinter(db, ctx, { id: uid(tag), name: 'P1', costCents: 600000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15 });
  const [task] = await insertTasks(db, ctx, [{ id: uid(tag), printerId: pr.id, task: 'Boquilla', everyHours: 300 }]);
  await insertExpense(db, ctx, { id: uid(tag), on: '2026-10-01', concept: 'Boquilla', category: 'Mantenimiento y refacciones', amountCents: 1000 });
  const prod = await insertProduct(db, ctx, { id: uid(tag), name: 'Llavero', mode: 'value', priceCents: 5000, hours: 1, printerId: pr.id, photoFileId: file.id });
  await replaceProductParts(db, ctx, prod.id, [{ id: uid(tag), filamentId: f.id, grams: 10 }], [{ id: uid(tag), supplyId: supply.id, qty: 1 }]);
  const col = await insertCollection(db, ctx, { id: uid(tag), name: 'Set' });
  await replaceCollectionParts(db, ctx, col.id, [{ id: uid(tag), productId: prod.id, qty: 2 }]);
  return { ctx, filamentId: f.id, spoolId: s.id, movementId: m!.id, supplierId: sup.id, supplyId: supply.id, printerId: pr.id, taskId: task!.id, productId: prod.id, collectionId: col.id, channelId: ch.id, fileId: file.id };
}

export async function twoWorkspaces(db: Db) {
  return { A: await aWorkspace(db, 0xa, 'Negocio A'), B: await aWorkspace(db, 0xb, 'Negocio B') };
}
