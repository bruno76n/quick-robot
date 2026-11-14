// Filament rules (docs/04 §1). A filament is material + color; a spool is one purchase of it.
// Everything is computed from data passed in: remaining grams come from the spool ledger.
import { normalizeName } from './catalog';
import { round1 } from './money';

export interface SpoolInput {
  id: string;
  /** Spool number (#1, #2…), per workspace and never reused (ronda-4 §2.4). Ties after the date; older data may lack it. */
  number?: number | undefined;
  /** Calendar date of the purchase, YYYY-MM-DD. */
  purchasedOn: string;
  /** Grams bought (the size of the spool). */
  grams: number;
  costPesos: number;
  shippingPesos: number;
  /** What is left, from the sum of its movements (may be slightly negative in old data). */
  remaining: number;
  /** A gift or a spool included with the printer: it counts in grams, not in cost (docs/04 §1). */
  noCost?: boolean | undefined;
  /** A deleted spool keeps its number but counts nowhere. */
  deleted?: boolean | undefined;
}

export type SpoolMovementKind = 'purchase' | 'consumption' | 'failure' | 'waste' | 'adjustment';
export type FilamentStatus = 'no_spools' | 'out' | 'ending' | 'low' | 'new' | 'ok';
export type SpoolStatus = 'empty' | 'new' | 'in_use';

/** "Empty" threshold used by the mockup: 0.5 g or less counts as nothing left. */
export const EMPTY_GRAMS = 0.5;
export const ENDING_GRAMS = 150;
export const LOW_GRAMS = 300;
export const NEW_RATIO = 0.95;

/** Same filament no matter spacing, case or accents: "PLA  negro" = "pla Negro" (docs/04 §1). */
export function filamentKey(material: string, color: string): string {
  return `${normalizeName(material)}|${normalizeName(color)}`;
}

export function spoolCostPerGram(s: Pick<SpoolInput, 'costPesos' | 'shippingPesos' | 'grams'> & { noCost?: boolean | undefined }): number {
  return !s.noCost && s.grams > 0 ? (s.costPesos + s.shippingPesos) / s.grams : 0;
}

export function spoolRemaining(movementGrams: readonly number[]): number {
  return round1(movementGrams.reduce((a, g) => a + g, 0));
}

const live = (spools: readonly SpoolInput[]) => spools.filter((s) => !s.deleted);

/** What there is of a filament: sum of what is left in all its spools; a spool never counts negative. */
export function filamentRemaining(spools: readonly SpoolInput[]): number {
  return round1(live(spools).reduce((a, s) => a + Math.max(0, s.remaining), 0));
}

/** How many purchases form the cost per gram of a filament (`cost_avg_purchases` of Ajustes). */
export const COST_AVG_PURCHASES = { min: 1, max: 10, default: 3 } as const;
/** Spools created at once by "Agregar rollo" (ronda-4 §4). */
export const SPOOL_QUANTITY = { min: 1, max: 20 } as const;
/** A weighed spool may hold up to its grams × this (ronda-4 §2.7). */
export const WEIGH_TOLERANCE = 1.05;

export type CostSource = 'purchases' | 'material' | 'reference' | 'none';

export interface FilamentCost {
  /** Pesos per gram, not rounded. */
  costPerGram: number;
  /** Where it comes from: its own purchases, the average of the material, its reference price, or nothing. */
  source: CostSource;
  /** Spools that formed the average, newest first (empty for `reference` and `none`). */
  spoolIds: string[];
  /** Their numbers, when the spools have one. */
  spoolNumbers: number[];
}

export interface FilamentCostOptions {
  /** Purchases in the average; 3 by default, kept between 1 and 10. */
  n?: number | undefined;
  /** All spools of the same material (any color), for the fallback. */
  materialSpools?: readonly SpoolInput[] | undefined;
  /** Reference price of the filament, cents per kg (asked when only no-cost spools exist). */
  referenceCentsPerKg?: number | null;
}

export function clampAvgPurchases(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return COST_AVG_PURCHASES.default;
  return Math.min(COST_AVG_PURCHASES.max, Math.max(COST_AVG_PURCHASES.min, Math.round(n)));
}

/** A purchase with cost: not a gift, not deleted, with grams and a price (a spool that cost $0 is a gift too). */
const hasCost = (s: SpoolInput) => !s.noCost && !s.deleted && s.grams > 0 && s.costPesos + s.shippingPesos > 0;

/** Ties after the date: by number when both have one, else by id. Ascending; negate for newest first. */
function byNumber(a: SpoolInput, b: SpoolInput): number {
  if (a.number !== undefined && b.number !== undefined && a.number !== b.number) return a.number - b.number;
  return a.id === b.id ? 0 : a.id > b.id ? 1 : -1;
}

/** The last N purchases with cost: by purchase date, newest first; ties by spool number, highest first. */
export function lastPurchasesWithCost(spools: readonly SpoolInput[], n?: number): SpoolInput[] {
  return spools.filter(hasCost)
    .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || byNumber(b, a))
    .slice(0, clampAvgPurchases(n));
}

function average(source: CostSource, used: readonly SpoolInput[]): FilamentCost {
  const grams = used.reduce((a, s) => a + s.grams, 0);
  const paid = used.reduce((a, s) => a + s.costPesos + s.shippingPesos, 0);
  return {
    costPerGram: grams > 0 ? paid / grams : 0, source,
    spoolIds: used.map((s) => s.id), spoolNumbers: used.flatMap((s) => (s.number === undefined ? [] : [s.number])),
  };
}

/**
 * Cost per gram of a filament (docs/04 §1, cases 1.1a–g): Σ (cost + shipping) / Σ grams of its last N purchases with cost,
 * whatever is left in them. Without any: the same with the spools of its material, then its reference price, then 0.
 */
export function filamentCost(spools: readonly SpoolInput[], opts: FilamentCostOptions = {}): FilamentCost {
  const own = lastPurchasesWithCost(spools, opts.n);
  if (own.length) return average('purchases', own);
  const material = lastPurchasesWithCost(opts.materialSpools ?? [], opts.n);
  if (material.length) return average('material', material);
  const ref = opts.referenceCentsPerKg;
  if (ref !== null && ref !== undefined && ref > 0) return { costPerGram: ref / 100 / 1000, source: 'reference', spoolIds: [], spoolNumbers: [] };
  return { costPerGram: 0, source: 'none', spoolIds: [], spoolNumbers: [] };
}

export function filamentCostPerGram(spools: readonly SpoolInput[], opts: FilamentCostOptions = {}): number {
  return filamentCost(spools, opts).costPerGram;
}

export interface FilamentOfWorkspace { id: string; material: string; referenceCentsPerKg?: number | null }

/** Cost per gram of every filament of a workspace, with the material fallback (material compared like names). */
export function filamentCosts(
  filaments: readonly FilamentOfWorkspace[], spools: readonly (SpoolInput & { filamentId: string })[], n?: number,
): Map<string, FilamentCost> {
  const materialOf = new Map(filaments.map((f) => [f.id, normalizeName(f.material)]));
  const byMaterial = new Map<string, SpoolInput[]>();
  for (const s of spools) {
    const m = materialOf.get(s.filamentId);
    if (m !== undefined) byMaterial.set(m, [...(byMaterial.get(m) ?? []), s]);
  }
  return new Map(filaments.map((f) => [f.id, filamentCost(spools.filter((s) => s.filamentId === f.id), {
    n, materialSpools: byMaterial.get(materialOf.get(f.id)!) ?? [], referenceCentsPerKg: f.referenceCentsPerKg ?? null,
  })]));
}

/** Value of the inventory (ronda-4 §2.3): what is left in each spool × the cost per gram of that spool (gifts are worth 0). */
export function inventoryValue(spools: readonly SpoolInput[]): number {
  return live(spools).reduce((a, s) => a + Math.max(0, s.remaining) * spoolCostPerGram(s), 0);
}

/** Numbers for `quantity` new spools (ronda-4 §2.4): consecutive from the highest ever used (deleted ones included) + 1. */
export function nextSpoolNumbers(existing: readonly number[], quantity: number): number[] {
  const start = existing.reduce((a, x) => Math.max(a, x), 0) + 1;
  return Array.from({ length: Math.max(0, Math.floor(quantity)) }, (_, i) => start + i);
}

/** Integer cents split in `parts` equal shares; the cents left over go to the first (shipping of N spools, ronda-4 §4). */
export function splitCents(totalCents: number, parts: number): number[] {
  const n = Math.max(0, Math.floor(parts));
  if (!n) return [];
  const each = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? totalCents - each * (n - 1) : each));
}

/** Order in which spools are used: the opened one first, then the oldest; ties by number (then id). */
export function spoolUseOrder(spools: readonly SpoolInput[]): SpoolInput[] {
  const isFull = (s: SpoolInput) => (s.remaining >= s.grams - 0.05 ? 1 : 0);
  return live(spools)
    .filter((s) => s.remaining > 0.05)
    .sort((a, b) => isFull(a) - isFull(b) || a.purchasedOn.localeCompare(b.purchasedOn) || byNumber(a, b));
}

/** Spool suggested in the dialogs: the first of the use order that is not empty. */
export function suggestedSpool(spools: readonly SpoolInput[]): SpoolInput | undefined {
  return spoolUseOrder(spools).find((s) => s.remaining > EMPTY_GRAMS);
}

export interface DeductionMovement {
  spoolId: string;
  kind: 'consumption' | 'waste';
  /** Negative grams, rounded to 0.1 g. */
  grams: number;
}

export interface Deduction {
  movements: DeductionMovement[];
  /** Grams actually taken (consumption + purge). */
  taken: number;
  /** Grams needed (consumption × (1 + purge)) that were not available. 0 when it all fit. */
  missing: number;
}

/** A part chosen by the person: grams with purge from a spool; without grams, all it has (up to what is still needed). */
export interface SpoolPick { spoolId: string; grams?: number | undefined }

export type SpoolPlanError =
  | { ok: false; code: 'SPOOL_INSUFFICIENT'; spoolId: string; availableGrams: number }
  | { ok: false; code: 'SPOOL_NOT_IN_FILAMENT'; spoolId: string };
export type SpoolPlan = ({ ok: true } & Deduction) | SpoolPlanError;

/**
 * Which spool is used (docs/04 §1, cases 1.2 and 1.5a–c). `grams` of consumption with purge `purgePct` need
 * grams × (1 + purge). The chosen parts go first (each ≤ what that spool has); what is still needed comes from the other
 * spools in the use order, then from what the chosen ones have left; whatever does not fit is `missing`. In each spool,
 * consumption = part / (1 + purge) and purge = part − consumption, each to 0.1 g. Never leaves a spool negative.
 */
export function planSpoolUse(spools: readonly SpoolInput[], grams: number, purgePct: number, picks: readonly SpoolPick[] = []): SpoolPlan {
  const k = 1 + purgePct / 100;
  const left = new Map(live(spools).map((s) => [s.id, Math.max(0, s.remaining)]));
  const parts = new Map<string, number>();
  let pending = grams > 0 ? grams * k : 0;
  const take = (id: string, want: number) => {
    const t = round1(Math.min(want, left.get(id)!, pending));
    if (t <= 0) return;
    parts.set(id, round1((parts.get(id) ?? 0) + t));
    left.set(id, left.get(id)! - t);
    pending -= t;
  };
  for (const p of picks) {
    const avail = left.get(p.spoolId);
    if (avail === undefined) return { ok: false, code: 'SPOOL_NOT_IN_FILAMENT', spoolId: p.spoolId };
    if (p.grams !== undefined && p.grams > avail + 0.05) return { ok: false, code: 'SPOOL_INSUFFICIENT', spoolId: p.spoolId, availableGrams: round1(avail) };
    take(p.spoolId, p.grams ?? avail);
  }
  const chosen = new Set(picks.map((p) => p.spoolId));
  const order = spoolUseOrder(spools);
  for (const s of [...order.filter((x) => !chosen.has(x.id)), ...order.filter((x) => chosen.has(x.id))]) {
    if (pending <= 0.0001) break;
    take(s.id, pending);
  }
  const movements: DeductionMovement[] = [];
  for (const [spoolId, part] of parts) {
    const consumption = round1(part / k);
    const purge = round1(part - consumption);
    if (consumption > 0) movements.push({ spoolId, kind: 'consumption', grams: -consumption });
    if (purge > 0) movements.push({ spoolId, kind: 'waste', grams: -purge });
  }
  const taken = round1([...parts.values()].reduce((a, g) => a + g, 0));
  const need = grams > 0 ? grams * k : 0;
  return { ok: true, movements, taken, missing: Math.max(0, round1(need - taken)) };
}

/** Deduct a job without a choice of spool (the automatic order). */
export function planDeduction(spools: readonly SpoolInput[], grams: number, purgePct: number): Deduction {
  const r = planSpoolUse(spools, grams, purgePct) as { ok: true } & Deduction;
  return { movements: r.movements, taken: r.taken, missing: r.missing };
}

/** Finish a spool (ronda-4 §2.6): a waste movement for all that is left; nothing left (≤ 0.5 g) → SPOOL_ALREADY_EMPTY. */
export function finishSpool(s: Pick<SpoolInput, 'remaining'>): { ok: true; grams: number } | { ok: false; code: 'SPOOL_ALREADY_EMPTY' } {
  if (!(s.remaining > EMPTY_GRAMS)) return { ok: false, code: 'SPOOL_ALREADY_EMPTY' };
  return { ok: true, grams: -round1(s.remaining) };
}

export type WeighResult =
  | { ok: true; leftGrams: number; adjustmentGrams: number | null }
  | { ok: false; code: 'WEIGHT_OUT_OF_RANGE'; maxGrams: number };

/**
 * Weigh a spool (ronda-4 §2.7): left = scale − empty spool. Valid if 0 ≤ left ≤ grams × 1.05; the adjustment is
 * left − what the ledger says (null when it is 0: nothing is recorded).
 */
export function weighSpool(s: Pick<SpoolInput, 'grams' | 'remaining'>, scaleGrams: number, tareGrams: number): WeighResult {
  const raw = scaleGrams - tareGrams;
  const left = round1(raw);
  const maxGrams = round1(s.grams * WEIGH_TOLERANCE);
  if (!Number.isFinite(raw) || !(left >= 0 && left <= maxGrams)) return { ok: false, code: 'WEIGHT_OUT_OF_RANGE', maxGrams };
  const delta = round1(left - s.remaining);
  return { ok: true, leftGrams: left, adjustmentGrams: delta === 0 ? null : delta };
}

/** Shortfall before producing: need = grams × (1 + purge); missing = need − available when positive. */
export function filamentShortfall(grams: number, purgePct: number, available: number): number {
  const need = grams * (1 + purgePct / 100);
  return need > available + 0.01 ? round1(need - available) : 0;
}

/** Status label of a filament (docs/04 §1, case 1.3). */
export function filamentStatus(all: readonly SpoolInput[]): FilamentStatus {
  const spools = live(all);
  if (!spools.length) return 'no_spools';
  const q = filamentRemaining(spools);
  const capacity = spools.filter((s) => s.remaining > EMPTY_GRAMS).reduce((a, s) => a + s.grams, 0);
  if (q <= EMPTY_GRAMS) return 'out';
  if (q <= ENDING_GRAMS) return 'ending';
  if (q <= LOW_GRAMS) return 'low';
  if (q >= capacity * NEW_RATIO) return 'new';
  return 'ok';
}

/** Status of a single spool (docs/04 §1). */
export function spoolStatus(s: Pick<SpoolInput, 'remaining' | 'grams'>): SpoolStatus {
  if (s.remaining <= EMPTY_GRAMS) return 'empty';
  if (s.remaining >= s.grams * NEW_RATIO) return 'new';
  return 'in_use';
}
