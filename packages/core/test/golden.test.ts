// Golden values (docs/10 §2.1): the product must give the same costs and prices as the mockup (±0.01),
// computed from the mockup's own example data.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { costProduct, type PrinterCost } from '../src/costs';
import { filamentCostPerGram, filamentRemaining, type SpoolInput } from '../src/filament';
import { floorPrice, listPrice, looseSum, setCost, setPrice, type SetPart } from '../src/pricing';
import { maintenanceState } from '../src/printers';

const golden = JSON.parse(readFileSync(new URL('./golden/mockup-values.json', import.meta.url), 'utf8'));
const b = JSON.parse(readFileSync(new URL('../../../reference/mockup-backup-v7.json', import.meta.url), 'utf8'));
const TOL = golden._tolerance as number;
const close = (a: number, e: number) => expect(Math.abs(a - e)).toBeLessThanOrEqual(TOL);

const settings = { kwhPrice: b.config.kwh, purgePct: b.config.purga, failurePct: b.config.fallos };
const spoolsOf = (fid: string): SpoolInput[] => b.rollos.filter((r: { fil: string }) => r.fil === fid).map((r: { id: string; fecha: string; gramos: number; costo: number; envio: number }) => ({
  id: r.id, purchasedOn: r.fecha, grams: r.gramos, costPesos: r.costo, shippingPesos: r.envio,
  remaining: b.movs.filter((m: { rollo: string }) => m.rollo === r.id).reduce((a: number, m: { g: number }) => a + m.g, 0),
}));
const printers = new Map<string, PrinterCost>(b.impresoras.map((p: { id: string; costo: number; vidaH: number; mantoH: number; kw: number }) => [p.id, { costPesos: p.costo, lifeHours: p.vidaH, maintenancePerHour: p.mantoH, kw: p.kw }]));
const supplyCost = new Map<string, number>(b.insumos.map((i: { id: string; costo: number }) => [i.id, i.costo]));

function costOf(p: { imp: string; horas: number; extras: number; filamentos: { fil: string; g: number }[]; insumos: { ins: string; cant: number }[] }) {
  return costProduct({
    hours: p.horas, extras: p.extras, printer: printers.get(p.imp) ?? null,
    filaments: p.filamentos.map((f) => ({ grams: f.g, costPerGram: filamentCostPerGram(spoolsOf(f.fil)) })),
    supplies: (p.insumos ?? []).map((x) => ({ qty: x.cant, unitCost: supplyCost.get(x.ins) ?? 0 })),
  }, [...printers.values()], settings);
}
const priceOf = (p: { modo: string; precio: number; margen?: number }) => listPrice(p.modo === 'formula' ? 'formula' : 'value', costOf(p as never).total, p.margen ?? b.config.margenFormula, p.precio);

describe('golden: pieces', () => {
  it.each(golden.productos.map((g: { id: string; nombre: string }) => [g.nombre, g]) as [string, unknown][])('%s', (_n, g) => {
    const p = b.productos.find((x: { id: string }) => x.id === (g as { id: string }).id);
    const c = costOf(p);
    const e = g as Record<string, number>;
    close(c.M, e.M!); close(c.L, e.L!); close(c.Q, e.Q!); close(c.E, e.E!); close(c.sub, e.sub!); close(c.F, e.F!); close(c.total, e.costo!);
    close(priceOf(p), e.precio!);
    close(floorPrice(c.total, b.config.margenMin), e.piso!);
  });
});

describe('golden: collections', () => {
  it.each(golden.colecciones.map((g: { nombre: string }) => [g.nombre, g]) as [string, unknown][])('%s', (_n, g) => {
    const e = g as { id: string; costo: number; precio: number; sueltas: number; piso: number };
    const c = b.colecciones.find((x: { id: string }) => x.id === e.id);
    const parts: SetPart[] = c.partes.map((r: { prod: string; cant: number }) => {
      const p = b.productos.find((x: { id: string }) => x.id === r.prod);
      return { productId: p.id, qty: r.cant, listPrice: priceOf(p), cost: costOf(p).total };
    });
    close(setCost(parts, c.extras), e.costo);
    close(looseSum(parts), e.sueltas);
    close(setPrice(c.precio, parts), e.precio);
    close(floorPrice(setCost(parts, c.extras), b.config.margenMin), e.piso);
  });
});

describe('golden: filaments, supplies and maintenance', () => {
  it.each(golden.filamentos.map((g: { nombre: string }) => [g.nombre, g]) as [string, unknown][])('%s', (_n, g) => {
    const e = g as { id: string; restante_g: number; costo_por_g: number };
    close(filamentRemaining(spoolsOf(e.id)), e.restante_g);
    close(filamentCostPerGram(spoolsOf(e.id)), e.costo_por_g);
  });

  it('supply stock is the sum of its ledger', () => {
    for (const e of golden.insumos as { id: string; stock: number }[]) {
      expect(b.imovs.filter((m: { ins: string }) => m.ins === e.id).reduce((a: number, m: { n: number }) => a + m.n, 0)).toBe(e.stock);
    }
  });

  it('maintenance state of every task', () => {
    const label = { ok: 'Al corriente', soon: 'Pronto', due: 'Toca ya' } as const;
    for (const ep of golden.impresoras as { id: string; horas: number; mantenimiento: { tarea: string; falta_h: number; estado: string }[] }[]) {
      const p = b.impresoras.find((x: { id: string }) => x.id === ep.id);
      for (const et of ep.mantenimiento) {
        const t = p.mant.find((x: { tarea: string }) => x.tarea === et.tarea);
        const s = maintenanceState({ everyHours: t.cadaH, lastHours: t.ultH }, p.horas);
        expect(s.remaining).toBe(et.falta_h);
        expect(label[s.status]).toBe(et.estado);
      }
    }
  });
});
