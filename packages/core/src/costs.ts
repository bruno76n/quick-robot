/**
 * Cost of a piece (docs/04 §2) — mockup `costo` and `impDe`.
 *   M = Σ grams × cost per gram × (1 + purge)      material
 *   L = hours × kW × kWh price                      electricity
 *   Q = hours × (printer cost / life + maint/h)     machine
 *   E = extras + Σ supply qty × supply cost         extras and supplies
 *   COST = (M + L + Q + E) / (1 − failures)
 * The person's working time does not enter: the price is free.
 */

export interface PrinterCostFacts {
  /** Purchase price in pesos. */
  cost: number;
  lifeHours: number;
  maintenancePerHour: number;
  kw: number;
}

export interface CostSettings {
  kwhPrice: number;
  purgePct: number;
  failurePct: number;
}

export interface PieceCostInput {
  hours: number;
  filaments: readonly { grams: number; costPerGram: number }[];
  supplies: readonly { qty: number; cost: number }[];
  extras: number;
  printer: PrinterCostFacts;
}

export interface CostBreakdown {
  M: number;
  L: number;
  Q: number;
  E: number;
  sub: number;
  /** Failure reserve = total − sub. */
  F: number;
  total: number;
}

const NO_PRINTER: PrinterCostFacts = { cost: 0, lifeHours: 1, maintenancePerHour: 0, kw: 0 };

/**
 * "Any printer": cost/life + maintenance and kW are the simple average of all printers;
 * life = 1 and maintenance = 0 so Q uses that average directly. No printers → all 0.
 */
export function averagePrinter(printers: readonly PrinterCostFacts[]): PrinterCostFacts {
  if (printers.length === 0) return NO_PRINTER;
  const avg = (f: (p: PrinterCostFacts) => number) => printers.reduce((t, p) => t + f(p), 0) / printers.length;
  return { cost: avg((p) => p.cost / p.lifeHours + p.maintenancePerHour), lifeHours: 1, maintenancePerHour: 0, kw: avg((p) => p.kw) };
}

/** The piece's printer, or the average when it has none ("cualquiera") or it no longer exists. */
export function printerForPiece(printerId: string | null | undefined, printers: readonly (PrinterCostFacts & { id: string })[]): PrinterCostFacts {
  const p = printerId ? printers.find((x) => x.id === printerId) : undefined;
  return p ?? averagePrinter(printers);
}

export function pieceCost(input: PieceCostInput, settings: CostSettings): CostBreakdown {
  const h = input.hours || 0;
  const p = input.printer;
  const M = input.filaments.reduce((t, f) => t + (f.grams || 0) * f.costPerGram * (1 + settings.purgePct / 100), 0);
  const L = h * p.kw * settings.kwhPrice;
  const Q = h * (p.cost / (p.lifeHours || 1) + p.maintenancePerHour);
  const E = (input.extras || 0) + input.supplies.reduce((t, s) => t + (s.qty || 0) * (s.cost || 0), 0);
  const sub = M + L + Q + E;
  const total = sub / (1 - settings.failurePct / 100);
  return { M, L, Q, E, sub, F: total - sub, total };
}
