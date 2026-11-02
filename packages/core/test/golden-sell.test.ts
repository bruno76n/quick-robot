// Golden values for phase 3 (docs/10 §3): sales, orders, customers, stock, ranking and investment must match the
// mockup (±0.01) with its own example data.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { customerStats } from '../src/customers';
import { ALL_TIME_FROM, expensesInRange, fixedPerMonth, type ExpenseData } from '../src/expenses';
import type { LineItemData } from '../src/line-items';
import { orderOwed, orderPaid, orderTotal, type OrderData } from '../src/orders';
import { investmentRecovered } from '../src/printers';
import { rankProducts, saleCommission, saleCost, saleGross, saleIncome, saleOwed, salePaid, saleProfit, salesTotals, type SaleData } from '../src/sales';
import { free, physical, reserved, type OrderStatus, type OrderStockView } from '../src/stock';

const golden = JSON.parse(readFileSync(new URL('./golden/mockup-values.json', import.meta.url), 'utf8'));
const b = JSON.parse(readFileSync(new URL('../../../reference/mockup-backup-v7.json', import.meta.url), 'utf8'));
const TOL = golden._tolerance as number;
const TODAY = golden._today as string;
const close = (a: number, e: number) => expect(Math.abs(a - e)).toBeLessThanOrEqual(TOL);

type RawItem = { k: 'p' | 'c'; prod?: string; col?: string; nombre: string; cant: number; precio: number; lista: number; costo: number; extras?: number; partes?: { prod: string; nombre: string; cant: number; lista: number; costo: number }[]; uso?: Record<string, number> | null };
const item = (i: RawItem): LineItemData => ({
  kind: i.k === 'c' ? 'set' : 'piece', productId: i.prod ?? null, collectionId: i.col ?? null, name: i.nombre, qty: i.cant,
  price: i.precio, list: i.lista, cost: i.costo, extras: i.extras ?? 0,
  parts: (i.partes ?? []).map((p) => ({ productId: p.prod, name: p.nombre, qty: p.cant, list: p.lista, cost: p.costo })),
  ...(i.uso ? { fromStock: i.uso } : {}),
});
const commission = (name: string) => (b.config.canales as { n: string; c: number }[]).find((c) => c.n === name)?.c ?? 0;
const STATUS: Record<string, OrderStatus> = { cotizado: 'quoted', aceptado: 'accepted', produccion: 'in_production', listo: 'ready', entregado: 'delivered', cancelado: 'cancelled' };

type RawSale = { id: string; fecha: string; canal: string; cliente: string; items: RawItem[]; pagos?: { monto: number }[] };
const sales = (b.ventas as RawSale[]).map((v) => ({
  id: v.id, on: v.fecha, channelId: v.canal, customerId: v.cliente,
  items: v.items.map(item), commissionPct: commission(v.canal), payments: v.pagos ? v.pagos.map((p) => p.monto) : null, returned: null,
})) satisfies (SaleData & Record<string, unknown>)[];

type RawOrder = { id: string; cliente: string; creado: string; entrega: string; estado: string; canal: string; items: RawItem[]; pagos: { monto: number }[]; stk?: Record<string, number> };
const orders = (b.pedidos as RawOrder[]).map((o) => ({
  id: o.id, customerId: o.cliente, createdOn: o.creado, dueOn: o.entrega, status: STATUS[o.estado]!,
  items: o.items.map(item), commissionPct: commission(o.canal), payments: o.pagos.map((p) => p.monto), reserved: o.stk ?? null,
})) satisfies (OrderData & OrderStockView & Record<string, unknown>)[];

const expenses: ExpenseData[] = (b.gastos as { fecha: string; monto: number; rec: boolean; fin: string }[]).map((g) => ({ on: g.fecha, amount: g.monto, recurring: g.rec, endsOn: g.fin || null }));

describe('golden: sales', () => {
  it.each((golden.ventas as { id: string }[]).map((g) => [g.id, g]))('%s', (id, g) => {
    const s = sales.find((x) => x.id === id)!;
    const e = g as unknown as Record<string, number>;
    close(saleGross(s), e.bruto!); close(saleIncome(s), e.ingreso!); close(saleCommission(s), e.comision!);
    close(saleCost(s), e.costo!); close(saleProfit(s), e.ganancia!); close(salePaid(s), e.pagado!); close(saleOwed(s), e.debe!);
  });

  it('totals', () => {
    const t = salesTotals(sales);
    const e = golden.totalesVentas;
    close(t.income, e.ingreso); close(t.commission, e.comision); close(t.cost, e.costo); close(t.profit, e.ganancia); close(t.marginPct, e.margen);
    expect(t.pieces).toBe(e.piezas);
  });

  it('ranking of pieces (sets split by list price)', () => {
    const r = rankProducts(sales);
    for (const e of golden.rankingPiezas as { id: string; cant: number; ingreso: number; costo: number; ganancia: number }[]) {
      const x = r.find((y) => y.productId === e.id)!;
      expect(x.qty).toBe(e.cant); close(x.income, e.ingreso); close(x.cost, e.costo); close(x.profit, e.ganancia);
    }
    expect(r.slice(0, golden.rankingPiezas.length).map((x) => x.productId)).toEqual(golden.rankingPiezas.map((x: { id: string }) => x.id));
  });
});

describe('golden: orders, customers and stock', () => {
  it.each((golden.pedidos as { id: string }[]).map((g) => [g.id, g]))('order %s', (id, g) => {
    const o = orders.find((x) => x.id === id)!;
    const e = g as unknown as { estado: string; total: number; pagado: number; debe: number };
    expect(o.status).toBe(STATUS[e.estado]);
    close(orderTotal(o), e.total); close(orderPaid(o), e.pagado); close(orderOwed(o), e.debe);
  });

  it.each((golden.clientes as { id: string; nombre: string }[]).map((g) => [g.nombre, g]))('customer %s', (_n, g) => {
    const e = g as unknown as { id: string; pedidos: number; activos: number; ventas: number; ingreso: number; ganancia: number; porCobrar: number };
    const c = customerStats(orders.filter((o) => o.customerId === e.id), sales.filter((s) => s.customerId === e.id));
    expect(c.orders).toBe(e.pedidos); expect(c.activeOrders).toBe(e.activos); expect(c.sales).toBe(e.ventas);
    close(c.income, e.ingreso); close(c.profit, e.ganancia); close(c.owed, e.porCobrar);
  });

  it.each((golden.existencias as { id: string }[]).map((g) => [g.id, g]))('stock %s', (id, g) => {
    const e = g as unknown as { fisicas: number; apartadas: number; libres: number };
    const ph = physical((b.pmovs as { prod: string; n: number }[]).filter((m) => m.prod === id).map((m) => m.n));
    const rs = reserved(id, orders);
    expect([ph, rs, free(ph, rs)]).toEqual([e.fisicas, e.apartadas, e.libres]);
  });
});

describe('golden: investment and expenses', () => {
  it('fixed per month', () => close(fixedPerMonth(expenses, TODAY), golden.fijosMes));

  it('investment recovered', () => {
    const e = golden.inversion;
    const gross = salesTotals(sales).profit;
    const spent = expensesInRange(expenses, ALL_TIME_FROM, TODAY);
    const r = investmentRecovered(gross, spent, (b.impresoras as { id: string; costo: number; horas: number }[]).map((p) => ({ id: p.id, costPesos: p.costo, hours: p.horas })));
    expect([r.equipment, r.hours]).toEqual([e.equipo, e.horas]);
    close(gross, e.gananciaBruta); close(spent, e.gastos); close(r.net, e.neta); close(r.recoveredPct, e.recuperadoPct);
  });
});
