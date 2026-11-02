// Checks of the mockup importer (docs/05 › Importar el mockup): the sums of the backup (computed with core the way the
// mockup does) against the sums of what was written — spools, stock, sales totals and what is owed.
import { filamentRemaining, orderOwed, orderTotal, round2, saleOwed, salesTotals, type OrderStatus } from '@app/core';
import { listAllFilaments, listSpools, physicalStock, listProducts, orderFacts, saleTotals, type Ctx, type Executor } from '@app/db';
import type { MockupBackup } from '@app/db/seed';
import type { Deps } from '../deps';
import { totalsOf } from './sell/fast';

type Item = { k: 'p' | 'c'; cant: number; precio: number; lista: number; costo: number; partes?: { cant: number }[] };
const asItems = (its: Item[]) => its.map((i) => ({ kind: i.k === 'c' ? 'set' as const : 'piece' as const, name: '', qty: i.cant, price: i.precio, list: i.lista, cost: i.costo, parts: (i.partes ?? []).map((p) => ({ productId: '', name: '', qty: p.cant, list: 0, cost: 0 })) }));
const STATUS: Record<string, OrderStatus> = { cotizado: 'quoted', aceptado: 'accepted', produccion: 'in_production', listo: 'ready', entregado: 'delivered', cancelado: 'cancelled' };

export function mockupSums(b: MockupBackup) {
  const spools: Record<string, number> = {};
  for (const f of b.filamentos) {
    spools[`${f.material} ${f.color}`] = round2(filamentRemaining(b.rollos.filter((r) => r.fil === f.id).map((r) => ({
      id: r.id, purchasedOn: r.fecha, grams: r.gramos, costPesos: r.costo, shippingPesos: r.envio, remaining: b.movs.filter((m) => m.rollo === r.id).reduce((a, m) => a + m.g, 0),
    }))));
  }
  const stock: Record<string, number> = {};
  for (const p of b.productos.filter((x) => x.stock)) stock[p.nombre] = Math.max(0, b.pmovs.filter((m) => m.prod === p.id).reduce((a, m) => a + m.n, 0));
  const commission = (n: string) => b.config.canales.find((c) => c.n === n)?.c ?? 0;
  const sales = b.ventas.map((v) => ({ id: v.id, items: asItems(v.items as never), commissionPct: commission(v.canal), payments: v.pagos ? v.pagos.map((p) => p.monto) : null, returned: v.dev ? { on: v.dev.fecha, restock: v.dev.repone, refund: v.dev.reembolso, note: '' } : null }));
  const t = salesTotals(sales);
  const owedOrders = b.pedidos.reduce((a, o) => { const s = STATUS[o.estado] ?? 'quoted'; return a + (s === 'delivered' || s === 'cancelled' ? 0 : orderOwed({ status: s, items: asItems(o.items as never), commissionPct: 0, payments: o.pagos.map((p) => p.monto) })); }, 0);
  return { spools, stock, income: round2(t.income), profit: round2(t.profit), owed: round2(owedOrders + sales.reduce((a, s) => a + saleOwed(s), 0)), ordersTotal: round2(b.pedidos.reduce((a, o) => a + orderTotal({ items: asItems(o.items as never) }), 0)) };
}

/** Differences as short texts ("spool:PLA Negro 410 → 400"); an empty list means the import matches the backup. */
export async function compareMockupSums(_deps: Deps, ex: Executor, ctx: Ctx, b: MockupBackup): Promise<string[]> {
  const want = mockupSums(b);
  const out: string[] = [];
  const fils = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, fils.map((f) => f.id));
  for (const [name, grams] of Object.entries(want.spools)) {
    const f = fils.find((x) => `${x.material} ${x.color}` === name);
    const got = round2(spools.filter((x) => x.filamentId === f?.id).reduce((a, x) => a + Math.max(0, x.remainingGrams), 0));
    if (Math.abs(got - grams) > 0.05) out.push(`spool:${name} ${grams} → ${got}`);
  }
  const products = await listProducts(ex, ctx);
  const ph = await physicalStock(ex, ctx);
  for (const [name, qty] of Object.entries(want.stock)) {
    const got = ph.get(products.find((p) => p.name === name)?.id ?? '') ?? 0;
    if (got !== qty) out.push(`stock:${name} ${qty} → ${got}`);
  }
  const t = totalsOf((await saleTotals(ex, ctx))[0]);
  if (Math.abs(t.incomeCents / 100 - want.income) > 0.01) out.push(`sales.income ${want.income} → ${t.incomeCents / 100}`);
  if (Math.abs(t.profitCents / 100 - want.profit) > 0.01) out.push(`sales.profit ${want.profit} → ${t.profitCents / 100}`);
  const orders = await orderFacts(ex, ctx);
  const owedOrders = orders.reduce((a, o) => a + (o.status === 'delivered' || o.status === 'cancelled' ? 0 : Math.max(0, o.grossCents - o.paidCents)), 0);
  const owed = round2((owedOrders + t.owedCents) / 100);
  if (Math.abs(owed - want.owed) > 0.01) out.push(`owed ${want.owed} → ${owed}`);
  return out;
}
