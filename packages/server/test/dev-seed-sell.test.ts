// Through the API, the seeded mockup business gives the mockup's own figures (golden, ±0.01) for phase 3.
import { stockPage } from '@app/contract';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../src/dev-seed';
import { makeHarness, type Harness } from './harness';

const golden = JSON.parse(readFileSync(new URL('../../core/test/golden/mockup-values.json', import.meta.url), 'utf8'));
let h: Harness;
beforeAll(async () => { h = await makeHarness(); await applyDevelopmentSeed(h.deps, h.A); }, 60_000);
afterAll(() => h.close());
const get = async (p: string) => (await h.call('GET', p)).json.data as never;
const pesos = (c: number) => c / 100;
const near = (a: number, e: number, tol = 0.011) => expect(Math.abs(a - e)).toBeLessThanOrEqual(tol);

describe('seeded phase 3 figures', () => {
  it('sales totals since always', async () => {
    const r = await get('/api/v1/reports?period=all') as { totals: { incomeCents: number; commissionCents: number; costCents: number; profitCents: number; pieces: number }; topProducts: { name: string; qty: number; profitCents: number }[]; investmentRecovered: { recoveredPct: number } };
    const e = golden.totalesVentas;
    near(pesos(r.totals.incomeCents), e.ingreso); near(pesos(r.totals.commissionCents), e.comision); near(pesos(r.totals.costCents), e.costo); near(pesos(r.totals.profitCents), e.ganancia);
    expect(r.totals.pieces).toBe(e.piezas);
    expect(r.topProducts.slice(0, golden.rankingPiezas.length).map((x) => x.name)).toEqual(golden.rankingPiezas.map((x: { nombre: string }) => x.nombre));
    for (const [i, e] of (golden.rankingPiezas as { cant: number; ganancia: number }[]).entries()) { expect(r.topProducts[i]!.qty).toBe(e.cant); near(pesos(r.topProducts[i]!.profitCents), e.ganancia); }
    near(r.investmentRecovered.recoveredPct, golden.inversion.recuperadoPct, 0.06);
  });

  it('stock: physical, reserved and free per piece', async () => {
    const s = stockPage.parse(await get('/api/v1/stock'));
    const names = new Map(golden.productos.map((p: { id: string; nombre: string }) => [p.id, p.nombre]));
    // Spider-Man · salto and its variant are one family row; each member keeps its own numbers.
    const pieces: { name: string; physical: number; reserved: number; free: number }[] = s.items.flatMap((r): { name: string; physical: number; reserved: number; free: number }[] => (r.members.length ? r.members : [r]));
    for (const e of golden.existencias as { id: string; fisicas: number; apartadas: number; libres: number }[]) {
      const x = pieces.find((i) => i.name === names.get(e.id))!;
      expect([x.physical, x.reserved, x.free]).toEqual([e.fisicas, e.apartadas, e.libres]);
    }
  });

  it('orders and customers', async () => {
    const o = await get('/api/v1/orders?pageSize=200') as { items: { number: number; totalCents: number; paidCents: number; owedCents: number }[] };
    for (const e of golden.pedidos as { folio: number; total: number; pagado: number; debe: number }[]) {
      const x = o.items.find((i) => i.number === e.folio)!;
      expect([pesos(x.totalCents), pesos(x.paidCents), pesos(x.owedCents)]).toEqual([e.total, e.pagado, e.debe]);
    }
    const c = await get('/api/v1/customers') as { name: string; orders: number; activeOrders: number; sales: number; incomeCents: number; profitCents: number; owedCents: number }[];
    for (const e of golden.clientes as { nombre: string; pedidos: number; activos: number; ventas: number; ingreso: number; ganancia: number; porCobrar: number }[]) {
      const x = c.find((i) => i.name === e.nombre)!;
      expect([x.orders, x.activeOrders, x.sales]).toEqual([e.pedidos, e.activos, e.ventas]);
      near(pesos(x.incomeCents), e.ingreso); near(pesos(x.profitCents), e.ganancia); near(pesos(x.owedCents), e.porCobrar);
    }
  });

  it('expenses: fixed per month and since always', async () => {
    const x = await get('/api/v1/expenses') as { fixedPerMonthCents: number; periodTotalCents: number };
    expect(pesos(x.fixedPerMonthCents)).toBe(golden.fijosMes);
    near(pesos(x.periodTotalCents), golden.inversion.gastos);
  });

  it('home, purchases, search and printers load', async () => {
    const home = await get('/api/v1/home') as { attentions: { kind: string }[]; stats: { activeOrders: number } };
    expect(home.stats.activeOrders).toBe(6);
    expect(home.attentions.length).toBeGreaterThan(0);
    const p = await get('/api/v1/purchases') as { count: number };
    expect(p.count).toBeGreaterThan(0);
    const s = await get('/api/v1/search?q=spider') as { products: unknown[] };
    expect(s.products.length).toBeGreaterThan(0);
    const pr = await get('/api/v1/printers') as { items: { queue: unknown[] }[] };
    expect(pr.items.some((x) => x.queue.length > 0)).toBe(true);
  });
});
