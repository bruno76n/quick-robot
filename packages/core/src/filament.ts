/**
 * Filament rules (docs/04 §1). Faithful translation of the mockup's `costoG`, `restante`, `costoGF`,
 * `ordenRollos`, `sacar`, `descontar`, `faltan`, `estFil`, `rolloEstado` and `filKey`.
 *
 * A filament is material + color. A spool is one purchase of a filament. How much is left is never stored:
 * it is the sum of the spool's movements (ledger).
 */
import { round1 } from './money';

/** A spool as core needs it. Money in pesos. Dates are ISO calendar dates (YYYY-MM-DD). */
export interface SpoolFacts {
  id: string;
  cost: number;
  shipping: number;
  grams: number;
  purchasedOn: string;
}

export interface SpoolMovementFacts {
  spoolId: string;
  /** Signed grams: purchase is positive, consumption/failure/waste negative, adjustment either. */
  grams: number;
}

export type SpoolMovementKind = 'purchase' | 'consumption' | 'failure' | 'waste' | 'adjustment';

/** Spool with the grams it has left (already summed from its ledger). */
export interface SpoolWithRemaining extends SpoolFacts {
  remaining: number;
}

/** Tolerances used by the mockup. */
export const EMPTY_SPOOL_GRAMS = 0.5;
const USABLE_SPOOL_GRAMS = 0.05;
const SHORTFALL_TOLERANCE = 0.01;

/** Cost per gram of one spool = (cost + shipping) / grams. */
export function spoolCostPerGram(spool: Pick<SpoolFacts, 'cost' | 'shipping' | 'grams'>): number {
  if (!(spool.grams > 0)) return 0;
  return (spool.cost + spool.shipping) / spool.grams;
}

/** Grams left in a spool: the sum of its movements (may be negative in the raw ledger). */
export function spoolRemaining(spoolId: string, movements: readonly SpoolMovementFacts[]): number {
  let total = 0;
  for (const m of movements) if (m.spoolId === spoolId) total += m.grams;
  return total;
}

/** Attach the remaining grams to each spool. */
export function withRemaining(spools: readonly SpoolFacts[], movements: readonly SpoolMovementFacts[]): SpoolWithRemaining[] {
  return spools.map((s) => ({ ...s, remaining: spoolRemaining(s.id, movements) }));
}

/** What there is of a filament = Σ remaining of all its spools, any brand. A spool never counts as negative. */
export function filamentRemaining(spools: readonly SpoolWithRemaining[]): number {
  return spools.reduce((acc, s) => acc + Math.max(0, s.remaining), 0);
}

const byNewestPurchase = (a: SpoolFacts, b: SpoolFacts) =>
  b.purchasedOn.localeCompare(a.purchasedOn) || (b.id > a.id ? 1 : -1);

/**
 * Cost per gram of a filament: average of its spools weighted by what is left.
 * If nothing is left (≤ 0.5 g in total) it is the cost per gram of the latest purchase. No spools → 0.
 */
export function filamentCostPerGram(spools: readonly SpoolWithRemaining[]): number {
  if (spools.length === 0) return 0;
  let weight = 0;
  let total = 0;
  for (const s of spools) {
    const q = Math.max(0, s.remaining);
    weight += q;
    total += q * spoolCostPerGram(s);
  }
  if (weight > EMPTY_SPOOL_GRAMS) return total / weight;
  const latest = [...spools].sort(byNewestPurchase)[0]!;
  return spoolCostPerGram(latest);
}

/** Value of what is left (Σ remaining × cost per gram of each spool). */
export function filamentValue(spools: readonly SpoolWithRemaining[]): number {
  return spools.reduce((acc, s) => acc + Math.max(0, s.remaining) * spoolCostPerGram(s), 0);
}

const isOpened = (s: SpoolWithRemaining) => s.remaining < s.grams - USABLE_SPOOL_GRAMS;

/**
 * Order in which spools are used: first the one already opened, then the oldest purchase; tie by id.
 * Spools with nothing usable left are excluded.
 */
export function spoolConsumptionOrder<T extends SpoolWithRemaining>(spools: readonly T[]): T[] {
  return spools
    .filter((s) => s.remaining > USABLE_SPOOL_GRAMS)
    .sort(
      (a, b) =>
        Number(!isOpened(a)) - Number(!isOpened(b)) ||
        a.purchasedOn.localeCompare(b.purchasedOn) ||
        (a.id > b.id ? 1 : -1),
    );
}

export interface PlannedSpoolMovement {
  spoolId: string;
  kind: 'consumption' | 'waste' | 'failure';
  /** Negative grams, rounded to 0.1. */
  grams: number;
}

/**
 * Take `grams` out of a filament, spool by spool in consumption order. A spool never goes negative:
 * returns what could be taken (mockup `sacar`). Each spool's take is rounded to 0.1 g.
 */
export function planTake(
  spools: readonly SpoolWithRemaining[],
  grams: number,
  kind: PlannedSpoolMovement['kind'],
): { movements: PlannedSpoolMovement[]; taken: number; spools: SpoolWithRemaining[] } {
  const state = spools.map((s) => ({ ...s }));
  const movements: PlannedSpoolMovement[] = [];
  let left = grams;
  let taken = 0;
  for (const s of spoolConsumptionOrder(state)) {
    if (left <= 0.0001) break;
    const t = round1(Math.min(left, s.remaining));
    if (t <= 0) continue;
    movements.push({ spoolId: s.id, kind, grams: -t });
    s.remaining -= t;
    left -= t;
    taken += t;
  }
  return { movements, taken: round1(taken), spools: state };
}

export interface DeductionPlan {
  movements: PlannedSpoolMovement[];
  /** Grams recorded as consumption. */
  consumed: number;
  /** Grams recorded as purge (waste). */
  purged: number;
  /** Grams needed including purge: g·(1 + p/100). */
  needed: number;
  /** needed − available, when positive; 0 otherwise. The job may still continue. */
  missing: number;
}

/**
 * Deduct a job of `grams` with purge `purgePct` from one filament (mockup `descontar`).
 * Needs g·(1+p/100); takes what there is; consumption and purge are recorded separately, each rounded to 0.1 g.
 */
export function planDeduction(spools: readonly SpoolWithRemaining[], grams: number, purgePct: number): DeductionPlan {
  const k = 1 + purgePct / 100;
  const needed = grams * k;
  const available = filamentRemaining(spools);
  const missing = needed > available + SHORTFALL_TOLERANCE ? needed - available : 0;
  if (!(grams > 0)) return { movements: [], consumed: 0, purged: 0, needed: 0, missing: 0 };
  const take = Math.min(needed, available);
  if (take <= 0) return { movements: [], consumed: 0, purged: 0, needed, missing };
  const consumption = planTake(spools, take / k, 'consumption');
  const purge = planTake(consumption.spools, take - take / k, 'waste');
  return {
    movements: [...consumption.movements, ...purge.movements],
    consumed: consumption.taken,
    purged: purge.taken,
    needed,
    missing,
  };
}

export interface Shortfall {
  filamentId: string;
  need: number;
  available: number;
  missing: number;
}

/**
 * Before producing: for each filament need = g·(1+purge/100); if need > available, missing = need − available.
 * `required` maps filament id → grams (without purge); `available` maps filament id → grams left.
 */
export function filamentShortfalls(
  required: Readonly<Record<string, number>>,
  available: Readonly<Record<string, number>>,
  purgePct: number,
): Shortfall[] {
  const out: Shortfall[] = [];
  for (const [filamentId, grams] of Object.entries(required)) {
    const need = grams * (1 + purgePct / 100);
    const have = available[filamentId] ?? 0;
    if (need > have + SHORTFALL_TOLERANCE) out.push({ filamentId, need, available: have, missing: need - have });
  }
  return out;
}

/** Filament stock status as the mockup's `estFil`. Tone: bad (red), warn (amber), info (blue), good (green), plain. */
export type FilamentStatus = 'no_spools' | 'out' | 'running_out' | 'low' | 'new' | 'normal';
export type Tone = 'bad' | 'warn' | 'info' | 'good' | 'plain';

export const FILAMENT_RUNNING_OUT_GRAMS = 150;
export const FILAMENT_LOW_GRAMS = 300;

export function filamentStatus(spools: readonly SpoolWithRemaining[]): { status: FilamentStatus; tone: Tone } {
  if (spools.length === 0) return { status: 'no_spools', tone: 'plain' };
  const q = filamentRemaining(spools);
  const capacity = activeSpools(spools).reduce((acc, s) => acc + s.grams, 0);
  if (q <= EMPTY_SPOOL_GRAMS) return { status: 'out', tone: 'bad' };
  if (q <= FILAMENT_RUNNING_OUT_GRAMS) return { status: 'running_out', tone: 'bad' };
  if (q <= FILAMENT_LOW_GRAMS) return { status: 'low', tone: 'warn' };
  if (q >= capacity * 0.95) return { status: 'new', tone: 'info' };
  return { status: 'normal', tone: 'good' };
}

/** Spools that still have material (> 0.5 g). */
export function activeSpools<T extends SpoolWithRemaining>(spools: readonly T[]): T[] {
  return spools.filter((s) => s.remaining > EMPTY_SPOOL_GRAMS);
}

export type SpoolStatus = 'empty' | 'new' | 'in_use';

/** Spool status as the mockup's `rolloEstado`. */
export function spoolStatus(spool: SpoolWithRemaining): SpoolStatus {
  if (spool.remaining <= EMPTY_SPOOL_GRAMS) return 'empty';
  if (spool.remaining >= spool.grams * 0.95) return 'new';
  return 'in_use';
}

/** Fill level 0..100 for the stock bar: remaining over the capacity of active spools. */
export function filamentFillPct(spools: readonly SpoolWithRemaining[]): number {
  const capacity = activeSpools(spools).reduce((acc, s) => acc + s.grams, 0);
  return capacity ? Math.min(100, (filamentRemaining(spools) / capacity) * 100) : 0;
}

/**
 * Normalized identity of a name: "PLA  negro" and "pla Negro" are the same
 * (no case, no accents, single spaces) — mockup `norm`.
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Unique key of a filament within a workspace (material + color, case/accents insensitive). */
export function filamentKey(material: string, color: string): string {
  return `${normalizeName(material)}|${normalizeName(color)}`;
}

/** Canonical display spelling for a typed name: trims and collapses spaces (mockup `canon`). */
export function cleanName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** List order of filaments: by material, then color, Spanish collation (mockup `filsOrd`). */
export function compareFilaments(a: { material: string; color: string }, b: { material: string; color: string }): number {
  return a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es');
}

/**
 * Spools as shown in the drawer: first those with material in consumption order, then the empty ones,
 * newest first (mockup `filDetalle`). `usedFirst` is set only when more than one spool has material.
 */
export function spoolsForDisplay<T extends SpoolWithRemaining>(spools: readonly T[]): (T & { usedFirst: boolean })[] {
  const order = spoolConsumptionOrder(spools);
  const empty = spools.filter((s) => !order.includes(s)).sort(byNewestPurchase);
  const firstId = order.length > 1 ? order[0]!.id : null;
  return [...order, ...empty].map((s) => ({ ...s, usedFirst: s.id === firstId }));
}

/** Default swatch when a color has no hex in the catalog (mockup `colorHex`). */
export const DEFAULT_FILAMENT_HEX = '#9a9aa6';
