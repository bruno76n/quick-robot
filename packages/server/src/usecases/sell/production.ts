// Producción: print runs (docs/04 §8, docs/06 §9, docs/12 §8 › Producción y existencias).
import { BusinessError, type PrintRunInput, type Warning } from '@app/contract';
import { printRunEffects, printRunLock } from '@app/core';
import {
  addPrinterHours, deleteLedgerRowsOfPrintRun, getOrder, listQueue, deletePrintRun as deleteRun, getFile, getPrinter, getProduct, getPrintRun, insertPrintRun, insertPrintRunFilaments,
  insertStockMovements, listAllFilaments, listOrders, listPrinters, listSpoolMovements, listPrintRunFilaments, listPrintRuns, printRunTotals, listProducts, listSpools, stockMovementsByRef, transaction, updateProduct,
  type Ctx, type Executor,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { loadStock } from './common';
import { markReadyIn } from './orders';
import { dequeue } from './queue';
import { assertSpoolPicks, deductFilament, shortfall, useSupplies, type SpoolPicks } from './material';

/** One page of print runs; totals over the whole filter come from SQL (docs/15 §3). */
export async function printRunList(_deps: Deps, ex: Executor, ctx: Ctx, f: { reason?: string | undefined; page: number; pageSize: number; ids?: readonly string[] }) {
  const runs = await listPrintRuns(ex, ctx, { reason: f.reason, ids: f.ids, limit: f.pageSize, offset: (f.page - 1) * f.pageSize });
  const filRows = await listPrintRunFilaments(ex, ctx, runs.map((r) => r.id));
  const byRun = new Map<string, typeof filRows>();
  for (const x of filRows) byRun.set(x.printRunId, [...(byRun.get(x.printRunId) ?? []), x]);
  const products = new Map((await listProducts(ex, ctx, { withDeleted: true })).map((p) => [p.id, p.name]));
  const printers = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const fils = new Map((await listAllFilaments(ex, ctx)).map((x) => [x.id, x]));
  const orderIds = [...new Set(runs.map((r) => r.orderId).filter((x): x is string => !!x))];
  const orders = new Map((orderIds.length ? await listOrders(ex, ctx, { ids: orderIds }) : []).map((o) => [o.id, o.number]));
  const items = runs.map((r) => {
    const fs = byRun.get(r.id) ?? [];
    return {
      id: r.id, on: r.on, productId: r.productId, name: r.productId ? products.get(r.productId) ?? '' : r.text, text: r.text, qty: r.qty, printerId: r.printerId,
      printerName: r.printerId ? printers.get(r.printerId) ?? null : null, result: r.result, hours: r.hours, reason: r.reason, orderId: r.orderId, orderNumber: r.orderId ? orders.get(r.orderId) ?? null : null,
      photoUrl: r.photoFileId ? `/api/v1/files/${r.photoFileId}` : null, grams: Math.round(fs.reduce((a, x) => a + x.grams, 0) * 10) / 10,
      filaments: fs.map((x) => ({ filamentId: x.filamentId, name: fils.get(x.filamentId) ? `${fils.get(x.filamentId)!.material} ${fils.get(x.filamentId)!.color}` : '', hex: fils.get(x.filamentId)?.hex ?? '#c9c9d1', grams: x.grams })),
    };
  });
  const t = await printRunTotals(ex, ctx, { reason: f.reason, ids: f.ids });
  const totals = { pieces: t.pieces, hours: Math.round(t.hours * 100) / 100, grams: Math.round(t.grams * 10) / 10, failed: t.failed };
  return { items, page: f.page, pageSize: f.pageSize, total: t.count, totals };
}

export async function printRunDetail(deps: Deps, ex: Executor, ctx: Ctx, id: string) {
  const r = await getPrintRun(ex, ctx, id);
  if (!r) throw notFound('print_run');
  const view = (await printRunList(deps, ex, ctx, { page: 1, pageSize: 1, ids: [id] })).items[0]!;
  // What undoing it would do (mockup prodDlg): pieces it added, filament it gives back, or why it is locked.
  const piecesAdded = (await stockMovementsByRef(ex, ctx, id)).filter((m) => m.kind === 'print').reduce((a, m) => a + m.qty, 0);
  const free = r.productId ? (await loadStock(ex, ctx)).free(r.productId) : 0;
  const lock = printRunLock({ reason: r.reason as 'stock' | 'order' | 'test', piecesAdded }, free);
  let returnGrams = 0;
  for (const f of view.filaments) returnGrams += (await listSpoolMovements(ex, ctx, f.filamentId)).filter((m) => m.refId === id).reduce((a, m) => a + Math.abs(m.grams), 0);
  return { ...view, piecesAdded, returnGrams: Math.round(returnGrams * 10) / 10, lock };
}

/** A run deducts its filament (with purge; from the chosen spools first), adds pieces when it is for stock, uses supplies unless it is a test. */
export async function logPrintRun(deps: Deps, ctx: Ctx, input: PrintRunInput) {
  return transaction(deps.db, async (tx) => {
    const p = input.productId ? await getProduct(tx, ctx, input.productId) : undefined;
    if (input.productId && !p) throw notFound('product');
    if (input.printerId && !(await getPrinter(tx, ctx, input.printerId))) throw notFound('printer');
    if (input.photoFileId && !(await getFile(tx, ctx, input.photoFileId))) throw notFound('file');
    const fils = new Map((await listAllFilaments(tx, ctx)).map((x) => [x.id, x]));
    for (const f of input.filaments) if (!fils.has(f.filamentId)) throw notFound('filament');
    const grams: Record<string, number> = {};
    const picks: Record<string, { spoolId: string; grams?: number | undefined }[]> = {};
    for (const f of input.filaments) {
      grams[f.filamentId] = (grams[f.filamentId] ?? 0) + f.grams;
      if (f.spools?.length) picks[f.filamentId] = [...(picks[f.filamentId] ?? []), ...f.spools];
    }
    await assertSpoolPicks(tx, ctx, picks as SpoolPicks);
    const used = Object.keys(grams).filter((id) => grams[id]! > 0);
    const spools = await listSpools(tx, ctx, used);
    if (used.some((id) => !spools.some((s) => s.filamentId === id))) throw new BusinessError('NO_SPOOLS');
    const warn = await shortfall(tx, ctx, grams);
    const id = deps.ids.next();
    const reason = input.reason;
    await insertPrintRun(tx, ctx, {
      id, on: input.on, productId: p?.id ?? null, qty: input.qty, printerId: input.printerId ?? null, result: input.result, hours: Math.round(input.hours * 100) / 100,
      reason, text: input.text?.trim() ?? '', orderId: null, photoFileId: input.photoFileId ?? null,
    });
    await insertPrintRunFilaments(tx, ctx, used.map((filamentId) => ({ id: deps.ids.next(), printRunId: id, filamentId, grams: Math.round(grams[filamentId]! * 10) / 10 })));
    const note = p ? `${input.qty} × ${p.name}` : input.text?.trim() || 'Prueba';
    await deductFilament(tx, ctx, grams, { on: input.on, note, refId: id, nextId: () => deps.ids.next(), picks });
    if (p) {
      // Mockup printDlg + docs/04 §8: good pieces printed for stock enter Existencias; a piece that did not track stock starts tracking it.
      const startsTracking = !p.tracksStock && input.result === 'ok' && reason === 'stock';
      if (startsTracking) await updateProduct(tx, ctx, p.id, { tracksStock: true });
      const fx = printRunEffects({ result: input.result, reason, qty: input.qty, tracksStock: p.tracksStock || startsTracking }, p.supplies.map((s) => ({ supplyId: s.supplyId, qty: s.qty })));
      if (fx.stockQty) await insertStockMovements(tx, ctx, [{ id: deps.ids.next(), productId: p.id, on: input.on, kind: 'print', qty: fx.stockQty, note: 'Impresión para existencias', refId: id }]);
      await useSupplies(tx, ctx, fx.supplyUse, { on: input.on, note, refId: id, nextId: () => deps.ids.next() });
    }
    if (input.printerId && input.hours > 0) await addPrinterHours(tx, ctx, input.printerId, Math.round(input.hours * 100) / 100);
    return { id, warnings: warn ? [warn] : [] };
  }).then(async ({ id, warnings }) => ({ data: await printRunDetail(deps, deps.db, ctx, id), warnings }));
}

/** Undo: gives back filament and supplies, removes the pieces it added and its hours; locked for orders or used pieces. */
export async function deletePrintRun(deps: Deps, ctx: Ctx, id: string): Promise<Warning[]> {
  return transaction(deps.db, async (tx) => {
    const r = await getPrintRun(tx, ctx, id, { forUpdate: true });
    if (!r) throw notFound('print_run');
    const added = (await stockMovementsByRef(tx, ctx, id)).filter((m) => m.kind === 'print').reduce((a, m) => a + m.qty, 0);
    const free = r.productId ? (await loadStock(tx, ctx)).free(r.productId) : 0;
    const lock = printRunLock({ reason: r.reason as 'stock' | 'order' | 'test', piecesAdded: added }, free);
    if (lock) throw new BusinessError('PRINT_RUN_LOCKED', lock);
    const hadFilament = (await listPrintRunFilaments(tx, ctx, [id])).length > 0;
    const spool = await deleteLedgerRowsOfPrintRun(tx, ctx, id);
    if (r.printerId && r.hours > 0) await addPrinterHours(tx, ctx, r.printerId, -r.hours);
    await deleteRun(tx, ctx, id);
    return hadFilament && !spool.length ? [{ code: 'FILAMENT_NOT_RETURNED' } as Warning] : [];
  });
}

/** "Terminar" a job: out of the queue, the next one starts; with nothing left anywhere the order becomes ready. */
export async function finishQueueEntry(deps: Deps, ctx: Ctx, printerId: string, entryId: string) {
  return transaction(deps.db, async (tx) => {
    if (!(await getPrinter(tx, ctx, printerId))) throw notFound('printer');
    const entry = (await listQueue(tx, ctx, { printerIds: [printerId], forUpdate: true })).find((q) => q.id === entryId);
    if (!entry) throw notFound('queue_entry');
    await dequeue(tx, ctx, { id: entryId }, deps.clock.now());
    const left = await listQueue(tx, ctx, { orderId: entry.orderId });
    const o = await getOrder(tx, ctx, entry.orderId);
    const warnings: Warning[] = [];
    let readyTriggered = false;
    if (o && !left.length && o.status === 'in_production') { await markReadyIn(deps, tx, ctx, o.id); readyTriggered = true; }
    else if (o && left.length) {
      const names = new Map((await listPrinters(tx, ctx)).map((p) => [p.id, p.name]));
      warnings.push({ code: 'ORDER_WAITING_OTHER_PRINTERS', details: { orderNumber: o.number, printerNames: [...new Set(left.map((q) => names.get(q.printerId) ?? ''))] } });
    }
    return { data: { orderId: entry.orderId, readyTriggered }, warnings };
  });
}
