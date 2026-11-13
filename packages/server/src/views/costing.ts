// Costing context: everything core needs to cost pieces and sets, loaded once per request.
// The server always recalculates; it never trusts a cost sent by the client (CLAUDE.md rule 4).
import type { Breakdown, CollectionDetail, CollectionListItem, ProductDetail, ProductListItem } from '@app/contract';
import {
  costProduct, effectiveMargin, filamentCostPerGram, floorPrice, isTechnicalMaterial, listPrice, looseSum, partQty, profitAt,
  setCost, setPrice, suggestedPrice, toCents, variantDisplayName, type CostSettings, type PrinterCost, type SetPart,
} from '@app/core';
import {
  getSettings, listAllFilaments, listChannels, listPrinters, listSpools, type CollectionFull, type Ctx, type Executor, type FilamentRow,
  type ProductFull, type PrinterRow,
} from '@app/db';
import { getSuppliesByIds } from '@app/db';
import { toSpoolInput } from './filament-view';

export interface ProductExtras { photoUrl: string | null; free: number; physical: number; reserved: number; sold: number; printerName: string | null; parentName: string | null; collections: { id: string; name: string }[] }

export interface CostingContext {
  settings: CostSettings & { minMarginPct: number; formulaMarginPct: number };
  printers: Map<string, PrinterCost>;
  allPrinters: PrinterCost[];
  filamentCost: Map<string, number>;
  filaments: Map<string, FilamentRow>;
  supplyCost: Map<string, number>;
  channels: { id: string; name: string; commissionPct: number }[];
}

export const printerCost = (p: PrinterRow): PrinterCost => ({ costPesos: p.costCents / 100, lifeHours: p.lifeHours, maintenancePerHour: p.maintenanceCentsPerHour / 100, kw: p.kw });

export async function loadCostingContext(ex: Executor, ctx: Ctx, supplyIds: readonly string[] = []): Promise<CostingContext> {
  const s = await getSettings(ex, ctx);
  const printers = await listPrinters(ex, ctx);
  const filaments = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, filaments.map((f) => f.id));
  const supplies = await getSuppliesByIds(ex, ctx, supplyIds);
  return {
    settings: {
      kwhPrice: (s?.kwhPriceCents ?? 0) / 100, failurePct: s?.failurePct ?? 0, purgePct: s?.purgePct ?? 0,
      minMarginPct: s?.minMarginPct ?? 0, formulaMarginPct: s?.formulaMarginPct ?? 0,
    },
    printers: new Map(printers.map((p) => [p.id, printerCost(p)])),
    allPrinters: printers.map(printerCost),
    filamentCost: new Map(filaments.map((f) => [f.id, filamentCostPerGram(spools.filter((x) => x.filamentId === f.id).map(toSpoolInput))])),
    filaments: new Map(filaments.map((f) => [f.id, f])),
    supplyCost: new Map(supplies.map((x) => [x.id, x.costCents / 100])),
    channels: (await listChannels(ex, ctx)).map((c) => ({ id: c.id, name: c.name, commissionPct: c.commissionPct })),
  };
}

/** Supplies used by a set of pieces (to load their costs). */
export const supplyIdsOf = (products: readonly ProductFull[]) => [...new Set(products.flatMap((p) => p.supplies.map((s) => s.supplyId)))];

export function costOf(p: ProductFull, c: CostingContext) {
  // A printer that was deleted is not in the map: the piece is costed with the average (decision 2.3).
  return costProduct({
    hours: p.hours, extras: p.extrasCents / 100, printer: p.printerId ? c.printers.get(p.printerId) ?? null : null,
    filaments: p.filaments.map((f) => ({ grams: f.grams, costPerGram: c.filamentCost.get(f.filamentId) ?? 0 })),
    supplies: p.supplies.map((s) => ({ qty: s.qty, unitCost: c.supplyCost.get(s.supplyId) ?? 0 })),
  }, c.allPrinters, c.settings);
}

export function priceOf(p: ProductFull, c: CostingContext, total = costOf(p, c).total) {
  return listPrice(p.mode as 'value' | 'formula', total, effectiveMargin(p.marginPct, c.settings.formulaMarginPct), p.priceCents / 100);
}

export function breakdownOf(b: ReturnType<typeof costOf>): Breakdown {
  return { materialCents: toCents(b.M), powerCents: toCents(b.L), machineCents: toCents(b.Q), extrasCents: toCents(b.E), failureReserveCents: toCents(b.F), costCents: toCents(b.total) };
}

const hexesOf = (p: ProductFull, c: CostingContext) => p.filaments.map((f) => c.filaments.get(f.filamentId)?.hex ?? '#c9c9d1');

export function productListView(p: ProductFull, c: CostingContext, opts: ProductExtras): ProductListItem {
  const cost = costOf(p, c);
  return {
    id: p.id, name: p.name, tags: p.tags, parentId: p.parentId, photoUrl: opts.photoUrl, costCents: toCents(cost.total), listCents: toCents(priceOf(p, c, cost.total)),
    floorCents: toCents(floorPrice(cost.total, c.settings.minMarginPct)), tracksStock: p.tracksStock, free: opts.free,
    technical: p.filaments.some((f) => isTechnicalMaterial(c.filaments.get(f.filamentId)?.material ?? '')), mode: p.mode as 'value' | 'formula',
    hexes: hexesOf(p, c), hours: p.hours, printerId: p.printerId,
    printerName: opts.printerName, parentName: opts.parentName, collections: opts.collections, sold: opts.sold, physical: opts.physical, reserved: opts.reserved,
    displayName: variantDisplayName(p.name, p.parentId ? opts.parentName : null, p.variantLabel), variantLabel: p.parentId ? p.variantLabel : null,
  };
}

/** "PLA Silk Morado" (+ the other filaments): the Material column of the variants panel. */
export function materialOf(p: ProductFull, c: CostingContext): string | null {
  const names = [...new Set(p.filaments.map((f) => { const x = c.filaments.get(f.filamentId); return x ? `${x.material} ${x.color}` : ''; }).filter(Boolean))];
  return names.length ? names.join(' + ') : null;
}

export function productDetailView(p: ProductFull, c: CostingContext, opts: ProductExtras): ProductDetail {
  const cost = costOf(p, c);
  const list = priceOf(p, c, cost.total);
  const margin = effectiveMargin(p.marginPct, c.settings.formulaMarginPct);
  return {
    ...productListView(p, c, opts),
    marginPct: p.marginPct, priceCents: p.priceCents, batchSize: p.batchSize, extrasCents: p.extrasCents, note: p.note, spec: p.spec ?? null, photoFileId: p.photoFileId,
    filaments: p.filaments.map((f) => ({ filamentId: f.filamentId, grams: f.grams })), supplies: p.supplies.map((s) => ({ supplyId: s.supplyId, qty: s.qty })),
    breakdown: breakdownOf(cost), suggestedCents: toCents(suggestedPrice(cost.total, Math.min(95, margin))),
    profitByChannel: c.channels.map((ch) => ({
      channelId: ch.id, name: ch.name, commissionPct: ch.commissionPct,
      suggestedCents: toCents(suggestedPrice(cost.total, Math.min(95, margin), ch.commissionPct)), profitCents: toCents(profitAt(list, cost.total, ch.commissionPct).profit),
    })),
    stock: { physical: opts.physical, reserved: opts.reserved, free: opts.free },
  };
}

type Named = { id: string; name: string; parentId: string | null; variantLabel: string | null };
/** "<original> · <label>" for a variant whose original is in the list, the name otherwise. */
export const displayNameOf = (p: Named, byId: ReadonlyMap<string, { name: string }>) => variantDisplayName(p.name, p.parentId ? byId.get(p.parentId)?.name : null, p.variantLabel);
/** id → displayName for a list of pieces (their originals must be in the same list). */
export function displayNames(products: readonly Named[]): Map<string, string> {
  const byId = new Map(products.map((p) => [p.id, p]));
  return new Map(products.map((p) => [p.id, displayNameOf(p, byId)]));
}

export function setPartsOf(col: CollectionFull, products: ReadonlyMap<string, ProductFull>, c: CostingContext): (SetPart & { name: string })[] {
  return col.parts.flatMap((r) => {
    const p = products.get(r.productId);
    if (!p) return [];
    const total = costOf(p, c).total;
    return [{ productId: p.id, name: displayNameOf(p, products), qty: partQty(r.qty), listPrice: priceOf(p, c, total), cost: total }];
  });
}

export function collectionListView(col: CollectionFull, products: ReadonlyMap<string, ProductFull>, c: CostingContext, buildableSets: number, sold = 0): CollectionListItem {
  const parts = setPartsOf(col, products, c);
  return {
    id: col.id, name: col.name, tags: col.tags, listCents: toCents(setPrice(col.priceCents === null ? null : col.priceCents / 100, parts)),
    costCents: toCents(setCost(parts, col.extrasCents / 100)), looseCents: toCents(looseSum(parts)), buildableSets,
    pieces: parts.reduce((a, p) => a + p.qty, 0), hexes: [...new Set(parts.flatMap((p) => hexesOf(products.get(p.productId)!, c)))],
    partNames: parts.map((p) => p.name), typedPrice: Boolean(col.priceCents && col.priceCents > 0), sold,
    partHexes: parts.map((p) => hexesOf(products.get(p.productId)!, c)),
  };
}

export function collectionDetailView(col: CollectionFull, products: ReadonlyMap<string, ProductFull>, c: CostingContext, buildableSets: number): CollectionDetail {
  const parts = setPartsOf(col, products, c);
  const base = collectionListView(col, products, c, buildableSets);
  return {
    ...base, priceCents: col.priceCents, extrasCents: col.extrasCents, note: col.note,
    floorCents: toCents(floorPrice(setCost(parts, col.extrasCents / 100), c.settings.minMarginPct)),
    parts: parts.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, listCents: toCents(p.listPrice), costCents: toCents(p.cost) })),
  };
}
