// Development seed, phase 3 part: customers, orders, sales, stock ledger, print runs, expenses and queues from the
// mockup backup. Items keep the photo of the moment that the backup has (docs/04 §4), so they go straight to the repositories.
import { normalizeName, toCents } from '@app/core';
import {
  insertCustomer, insertExpense, insertLineItems, insertOrder, insertPayments, insertPrintRun, insertPrintRunFilaments, insertQueueEntries, insertSale,
  insertChannel, insertStockMovements, listChannels, transaction, type Ctx, type Executor,
} from '@app/db';
import { ORDER_STATUS, PRINT_REASON, STOCK_MOVEMENT_KIND, type MockItem, type MockupBackup } from '@app/db/seed';
import type { Deps } from './deps';

interface Maps { refs: Map<string, string>; productIds: Map<string, string>; collectionIds: Map<string, string>; printerIds: Map<string, string>; filamentIds: Map<string, string>; customerLogo?: ((dataUrl: string) => Promise<string | null>) | undefined; notes?: string[] }

function items(deps: Deps, ctx: Ctx, list: readonly MockItem[], parentKind: 'order' | 'sale', parentId: string, m: Maps) {
  return list.map((it, position) => ({
    id: deps.ids.next(), parentKind, parentId, position, kind: it.k === 'c' ? 'set' : 'piece', productId: it.prod ? m.productIds.get(it.prod) ?? null : null,
    collectionId: it.col ? m.collectionIds.get(it.col) ?? null : null, name: it.nombre, qty: it.cant, priceCents: toCents(it.precio), listCents: toCents(it.lista),
    costCents: it.costo * 100, extrasCents: toCents(it.extras ?? 0),
    parts: it.partes ? it.partes.map((p) => ({ productId: m.productIds.get(p.prod) ?? '', name: p.nombre, qty: p.cant, listCents: toCents(p.lista), costCents: p.costo * 100 })) : null,
    printerId: parentKind === 'order' && it.imp ? m.printerIds.get(it.imp) ?? null : null,
    fromStock: parentKind === 'order' && it.uso ? Object.fromEntries(Object.entries(it.uso).map(([k, v]) => [m.productIds.get(k) ?? k, v])) : null,
  }));
}

export async function seedSellData(deps: Deps, ctx: Ctx, b: MockupBackup, m: Maps) {
  await transaction(deps.db, async (tx: Executor) => {
    const channels = await listChannels(tx, ctx);
    // A channel that is no longer in the list is created with 0 % commission and noted in the summary (docs/05).
    const channel = async (name: string) => {
      const found = channels.find((c) => c.nameKey === normalizeName(name || ''));
      if (found) return found.id;
      if (!name) return channels[0]!.id;
      const row = await insertChannel(tx, ctx, { id: deps.ids.next(), name, nameKey: normalizeName(name), commissionPct: 0, position: channels.length });
      channels.push(row);
      m.notes?.push(`channel:${name}`);
      return row.id;
    };
    let nameless: string | null = null;
    const customerOf = async (id: string) => {
      const c = customers.get(id);
      if (c) return c;
      if (!nameless) {
        nameless = (await insertCustomer(tx, ctx, { id: deps.ids.next(), name: 'Sin nombre', nameKey: normalizeName('Sin nombre'), type: 'Otro', createdOn: '2000-01-01' })).id;
        m.notes?.push('customer:Sin nombre');
      }
      return nameless;
    };
    const customers = new Map<string, string>();
    for (const c of b.clientes) {
      const img = (c as { logoImg?: string }).logoImg;
      const logoFileId = img && m.customerLogo ? await m.customerLogo(img) : null;
      customers.set(c.id, (await insertCustomer(tx, ctx, { id: deps.ids.next(), name: c.nombre, nameKey: normalizeName(c.nombre), type: c.tipo || 'Otro', phone: c.tel ?? '', hasLogo: Boolean(c.logo || logoFileId), logoFileId, note: c.nota ?? '', createdOn: c.creado || '2000-01-01' })).id);
    }
    for (const o of b.pedidos) {
      const id = m.refs.get(o.id)!;
      await insertOrder(tx, ctx, {
        id, number: o.folio, customerId: await customerOf(o.cliente), status: ORDER_STATUS[o.estado] ?? 'quoted', channelId: await channel(o.canal), note: o.nota,
        createdOn: o.creado, dueOn: o.entrega, readyOn: o.listo ?? null, deliveredOn: o.entregado ?? null, productionOn: o.estado === 'produccion' ? o.creado : null,
        filamentDeducted: !!o.descontado, runsLogged: !!o.logueado,
        stockReserved: o.stk ? Object.fromEntries(Object.entries(o.stk).map(([k, v]) => [m.productIds.get(k) ?? k, v])) : null,
        cancellation: o.cancelado ? { on: o.cancelado.fecha, reason: o.cancelado.motivo, refundCents: toCents(o.cancelado.reembolso) } : null,
      });
      await insertLineItems(tx, ctx, items(deps, ctx, o.items, 'order', id, m));
      await insertPayments(tx, ctx, o.pagos.map((p) => ({ id: deps.ids.next(), parentKind: 'order', parentId: id, on: p.fecha, amountCents: toCents(p.monto), note: p.nota })));
    }
    for (const v of b.ventas) {
      const id = m.refs.get(v.id)!;
      await insertSale(tx, ctx, {
        id, on: v.fecha, channelId: await channel(v.canal), customerId: v.cliente ? customers.get(v.cliente) ?? null : null, orderId: v.pedido ? m.refs.get(v.pedido) ?? null : null,
        note: v.nota, tracksPayments: !!v.pagos, return: v.dev ? { on: v.dev.fecha, restock: v.dev.repone, refundCents: toCents(v.dev.reembolso), note: v.dev.nota } : null,
      });
      await insertLineItems(tx, ctx, items(deps, ctx, v.items, 'sale', id, m));
      if (v.pagos) await insertPayments(tx, ctx, v.pagos.map((p) => ({ id: deps.ids.next(), parentKind: 'sale', parentId: id, on: p.fecha, amountCents: toCents(p.monto), note: p.nota })));
    }
    await insertStockMovements(tx, ctx, b.pmovs.filter((x) => m.productIds.has(x.prod)).map((x) => ({
      id: deps.ids.next(), productId: m.productIds.get(x.prod)!, on: x.fecha, kind: STOCK_MOVEMENT_KIND[x.tipo] ?? 'adjustment', qty: x.n, note: x.nota, refId: x.ref ? m.refs.get(x.ref) ?? null : null,
    })));
    for (const r of b.imps) {
      const id = m.refs.get(r.id)!;
      await insertPrintRun(tx, ctx, {
        id, on: r.fecha, productId: r.prod ? m.productIds.get(r.prod) ?? null : null, qty: r.cant, printerId: m.printerIds.get(r.imp) ?? null, result: r.res === 'fallo' ? 'fail' : 'ok',
        hours: r.horas, reason: PRINT_REASON[r.motivo] ?? 'test', text: r.texto, orderId: r.pedido ? m.refs.get(r.pedido) ?? null : null,
      });
      await insertPrintRunFilaments(tx, ctx, r.filamentos.filter((f) => m.filamentIds.has(f.fil) && f.g > 0).map((f) => ({ id: deps.ids.next(), printRunId: id, filamentId: m.filamentIds.get(f.fil)!, grams: f.g })));
    }
    for (const g of b.gastos) await insertExpense(tx, ctx, { id: deps.ids.next(), on: g.fecha, concept: g.concepto, category: g.cat, amountCents: toCents(g.monto), recurring: g.rec, endsOn: g.fin || null });
    for (const p of b.impresoras) {
      const cola = (p as { cola?: { pedido: string; texto: string; min: number; inicio: number | null }[] }).cola ?? [];
      await insertQueueEntries(tx, ctx, cola.filter((q) => m.refs.has(q.pedido)).map((q, position) => ({
        id: deps.ids.next(), printerId: m.printerIds.get(p.id)!, orderId: m.refs.get(q.pedido)!, text: q.texto, minutes: q.min, position, startedAt: q.inicio ? new Date(q.inicio) : null,
      })));
    }
  });
}
