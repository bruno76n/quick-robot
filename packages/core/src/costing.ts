/**
 * Costing of catalog items from a plain context — the single function both the server (authority) and the
 * calculator preview (browser) use, so they can never disagree.
 */
import { pieceCost, printerForPiece, type CostBreakdown, type PrinterCostFacts } from './costs';
import { isTechnicalMaterial } from './defaults';
import { collectionCost, collectionPrice, effectiveMargin, floorPrice, listPrice, loosePrice, partQty, suggestedPrice, type PriceMode } from './pricing';

export interface CostingContext {
  settings: { kwhPrice: number; purgePct: number; failurePct: number; minMarginPct: number; formulaMarginPct: number };
  printers: readonly (PrinterCostFacts & { id: string })[];
  filaments: Readonly<Record<string, { costPerGram: number; material: string }>>;
  supplies: Readonly<Record<string, { cost: number }>>;
}

export interface ProductForCosting {
  mode: PriceMode;
  /** Written price (value mode), pesos. */
  price: number;
  marginPct: number | null;
  printerId: string | null;
  hours: number;
  extras: number;
  filaments: readonly { filamentId: string; grams: number }[];
  supplies: readonly { supplyId: string; qty: number }[];
}

export interface ProductCosting extends CostBreakdown {
  listPrice: number;
  floor: number;
  /** Suggested with the piece's margin (no channel). */
  suggested: number;
  marginPct: number;
  profit: number;
  technical: boolean;
}

export function costProduct(p: ProductForCosting, ctx: CostingContext): ProductCosting {
  const s = ctx.settings;
  const known = p.filaments.filter((f) => ctx.filaments[f.filamentId]);
  const cost = pieceCost(
    {
      hours: p.hours,
      extras: p.extras,
      filaments: known.map((f) => ({ grams: f.grams, costPerGram: ctx.filaments[f.filamentId]!.costPerGram })),
      supplies: p.supplies.filter((x) => ctx.supplies[x.supplyId]).map((x) => ({ qty: x.qty, cost: ctx.supplies[x.supplyId]!.cost })),
      printer: printerForPiece(p.printerId, ctx.printers),
    },
    { kwhPrice: s.kwhPrice, purgePct: s.purgePct, failurePct: s.failurePct },
  );
  const marginPct = effectiveMargin(p.marginPct, s.formulaMarginPct);
  const list = listPrice({ mode: p.mode, price: p.price, cost: cost.total, marginPct });
  return {
    ...cost,
    listPrice: list,
    floor: floorPrice(cost.total, s.minMarginPct),
    suggested: suggestedPrice(cost.total, Math.min(95, marginPct)),
    marginPct,
    profit: list - cost.total,
    technical: known.some((f) => isTechnicalMaterial(ctx.filaments[f.filamentId]!.material)),
  };
}

export interface CollectionCosting {
  parts: { productId: string; qty: number; listPrice: number; cost: number }[];
  loose: number;
  price: number;
  pieces: number;
  extras: number;
  cost: number;
  profit: number;
  pieceCount: number;
  floor: number;
}

/** Parts whose product no longer exists are ignored (`costed` has no entry for them). */
export function costCollection(
  c: { price: number | null; extras: number; parts: readonly { productId: string; qty: number }[] },
  costed: Readonly<Record<string, { listPrice: number; total: number }>>,
  minMarginPct: number,
): CollectionCosting {
  const parts = c.parts.filter((r) => costed[r.productId]).map((r) => ({ productId: r.productId, qty: partQty(r.qty), listPrice: costed[r.productId]!.listPrice, cost: costed[r.productId]!.total }));
  const loose = loosePrice(parts);
  const price = collectionPrice(c.price, loose);
  const cc = collectionCost(parts, c.extras);
  return { parts, loose, price, pieces: cc.pieces, extras: cc.extras, cost: cc.total, profit: price - cc.total, pieceCount: parts.reduce((t, p) => t + p.qty, 0), floor: floorPrice(cc.total, minMarginPct) };
}

/** Merge repeated pieces of a set into one line with the summed quantity (mockup `colLimpia`). */
export function mergeParts(parts: readonly { productId: string; qty: number }[]): { productId: string; qty: number }[] {
  const m = new Map<string, number>();
  for (const r of parts) if (r.productId) m.set(r.productId, (m.get(r.productId) ?? 0) + partQty(r.qty));
  return [...m].map(([productId, qty]) => ({ productId, qty }));
}
