// Filament rules (docs/04 §1). A filament is material + color; a spool is one purchase of it.
// Everything is computed from data passed in: remaining grams come from the spool ledger.
import { normalizeName } from './catalog';
import { round1 } from './money';

export interface SpoolInput {
  id: string;
  /** Calendar date of the purchase, YYYY-MM-DD. */
  purchasedOn: string;
  /** Grams bought (the size of the spool). */
  grams: number;
  costPesos: number;
  shippingPesos: number;
  /** What is left, from the sum of its movements (may be slightly negative in old data). */
  remaining: number;
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

export function spoolCostPerGram(s: Pick<SpoolInput, 'costPesos' | 'shippingPesos' | 'grams'>): number {
  return s.grams > 0 ? (s.costPesos + s.shippingPesos) / s.grams : 0;
}

export function spoolRemaining(movementGrams: readonly number[]): number {
  return round1(movementGrams.reduce((a, g) => a + g, 0));
}

/** What there is of a filament: sum of what is left in all its spools; a spool never counts negative. */
export function filamentRemaining(spools: readonly SpoolInput[]): number {
  return round1(spools.reduce((a, s) => a + Math.max(0, s.remaining), 0));
}

function latestPurchase(spools: readonly SpoolInput[]): SpoolInput | undefined {
  return [...spools].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || (b.id > a.id ? 1 : -1))[0];
}

/** Cost per gram weighted by what is left; if nothing is left, the cost of the last purchase (case 1.1). */
export function filamentCostPerGram(spools: readonly SpoolInput[]): number {
  if (!spools.length) return 0;
  let w = 0;
  let t = 0;
  for (const s of spools) {
    const q = Math.max(0, s.remaining);
    w += q;
    t += q * spoolCostPerGram(s);
  }
  if (w > EMPTY_GRAMS) return t / w;
  const last = latestPurchase(spools);
  return last ? spoolCostPerGram(last) : 0;
}

/** Order in which spools are used: the opened one first, then the oldest; ties by id. */
export function spoolUseOrder(spools: readonly SpoolInput[]): SpoolInput[] {
  const isFull = (s: SpoolInput) => (s.remaining >= s.grams - 0.05 ? 1 : 0);
  return spools
    .filter((s) => s.remaining > 0.05)
    .sort((a, b) => isFull(a) - isFull(b) || a.purchasedOn.localeCompare(b.purchasedOn) || (a.id > b.id ? 1 : -1));
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

function take(order: SpoolInput[], left: Map<string, number>, grams: number, kind: DeductionMovement['kind']) {
  const out: DeductionMovement[] = [];
  let pending = grams;
  for (const s of order) {
    if (pending <= 0.0001) break;
    const avail = left.get(s.id) ?? 0;
    const t = round1(Math.min(pending, avail));
    if (t <= 0) continue;
    out.push({ spoolId: s.id, kind, grams: -t });
    left.set(s.id, avail - t);
    pending -= t;
  }
  return out;
}

/**
 * Deduct a job of `grams` of consumption with purge `purgePct` (case 1.2). Takes what fits, spool by spool,
 * and records consumption and purge separately. Never leaves a spool negative.
 */
export function planDeduction(spools: readonly SpoolInput[], grams: number, purgePct: number): Deduction {
  const k = 1 + purgePct / 100;
  const need = grams * k;
  const available = filamentRemaining(spools);
  const takeTotal = Math.min(need, available);
  if (!(grams > 0) || takeTotal <= 0) return { movements: [], taken: 0, missing: grams > 0 ? round1(need) : 0 };
  const order = spoolUseOrder(spools);
  const left = new Map(order.map((s) => [s.id, Math.max(0, s.remaining)]));
  const consumption = take(order, left, takeTotal / k, 'consumption');
  const waste = take(order, left, takeTotal - takeTotal / k, 'waste');
  const movements = [...consumption, ...waste];
  const taken = round1(-movements.reduce((a, m) => a + m.grams, 0));
  return { movements, taken, missing: Math.max(0, round1(need - taken)) };
}

/** Shortfall before producing: need = grams × (1 + purge); missing = need − available when positive. */
export function filamentShortfall(grams: number, purgePct: number, available: number): number {
  const need = grams * (1 + purgePct / 100);
  return need > available + 0.01 ? round1(need - available) : 0;
}

/** Status label of a filament (docs/04 §1, case 1.3). */
export function filamentStatus(spools: readonly SpoolInput[]): FilamentStatus {
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
