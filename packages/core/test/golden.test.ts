// The product must give the same values as the mockup (CLAUDE.md › Valores del mockup, tolerance ±0.01).
import { describe, expect, it } from 'vitest';
import golden from './golden/mockup-values.json';
import { collectionCost, collectionPrice, effectiveMargin, filamentCostPerGram, floorPrice, listPrice, loosePrice, partQty, pieceCost, printerForPiece, suggestedPrice } from '../src';

const TOL = 0.01;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL);
const cfg = golden.config;
const settings = { kwhPrice: cfg.kwh, purgePct: cfg.purgePct, failurePct: cfg.failurePct };

const dayFromOffset = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

// Cost per gram from the spools' remaining grams (core), compared with the mockup.
const costPerGram = new Map(
  golden.filaments.map((f) => {
    const spools = golden.spools
      .filter((s) => s.filament === f.id)
      .map((s) => ({ id: s.id, cost: s.cost, shipping: s.shipping, grams: s.grams, purchasedOn: dayFromOffset(s.purchasedOffsetDays), remaining: s.remaining }));
    return [f.id, filamentCostPerGram(spools)];
  }),
);
const printers = golden.printers.map((p) => ({ id: p.id, cost: p.costo, lifeHours: p.vidaH, maintenancePerHour: p.mantoH, kw: p.kw }));
const supplyCost = new Map(golden.supplies.map((s) => [s.id, s.costo]));

type GoldenProduct = (typeof golden.products)[number]['input'];
function compute(p: GoldenProduct) {
  const cost = pieceCost(
    {
      hours: p.horas,
      extras: p.extras,
      filaments: p.filamentos.map((f) => ({ grams: f.g, costPerGram: costPerGram.get(f.fil)! })),
      supplies: p.insumos.map((s) => ({ qty: s.cant, cost: supplyCost.get(s.ins)! })),
      printer: printerForPiece(p.imp === '*' ? null : p.imp, printers),
    },
    settings,
  );
  const margin = effectiveMargin((p as { margen?: number | null }).margen ?? null, cfg.formulaMarginPct);
  return { cost, margin, list: listPrice({ mode: p.modo === 'formula' ? 'formula' : 'value', price: p.precio, cost: cost.total, marginPct: margin }) };
}

describe('golden: filament cost per gram', () => {
  it.each(golden.filaments.map((f) => [f.id, f.costPerGram] as const))('%s', (id, expected) => near(costPerGram.get(id)!, expected));
});

describe('golden: pieces', () => {
  it.each(golden.products.map((p) => [p.input.nombre, p] as const))('%s', (_name, p) => {
    const { cost, margin, list } = compute(p.input);
    const e = p.expected;
    near(cost.M, e.M);
    near(cost.L, e.L);
    near(cost.Q, e.Q);
    near(cost.E, e.E);
    near(cost.F, e.F);
    near(cost.total, e.cost);
    near(list, e.listPrice);
    near(floorPrice(cost.total, cfg.minMarginPct), e.floor);
    near(suggestedPrice(cost.total, Math.min(95, margin)), e.suggested);
    for (const ch of e.byChannel) near(suggestedPrice(cost.total, Math.min(95, margin), ch.commission), ch.suggested);
  });
});

describe('golden: collections', () => {
  it.each(golden.collections.map((c) => [c.input.nombre, c] as const))('%s', (_name, c) => {
    const parts = c.input.partes.map((r) => {
      const p = golden.products.find((x) => x.input.id === r.prod)!.input;
      const { cost, list } = compute(p);
      return { qty: partQty(r.cant), listPrice: list, cost: cost.total };
    });
    const loose = loosePrice(parts);
    near(loose, c.expected.loose);
    near(collectionPrice(c.input.precio, loose), c.expected.price);
    const cc = collectionCost(parts, c.input.extras);
    near(cc.pieces, c.expected.pieces);
    near(cc.total, c.expected.cost);
  });
});
