// Cost of a piece (docs/04 §2): M material, L power, Q machine, E extras and supplies, F failure reserve.
// The person's working time does not count: the price is free.

export interface CostSettings {
  /** Price of a kWh, pesos. */
  kwhPrice: number;
  failurePct: number;
  purgePct: number;
}

export interface PrinterCost {
  costPesos: number;
  lifeHours: number;
  maintenancePerHour: number;
  kw: number;
}

export interface ProductCostInput {
  hours: number;
  extras: number;
  /** null = average of the printers ("cualquiera"). */
  printer: PrinterCost | null;
  filaments: readonly { grams: number; costPerGram: number }[];
  supplies: readonly { qty: number; unitCost: number }[];
}

export interface CostBreakdown { M: number; L: number; Q: number; E: number; sub: number; F: number; total: number }

/**
 * Average printer (docs/04 §2): cost/life + maintenance and kW are simple averages of all printers; life = 1 and
 * maintenance = 0 so the formula stays the same. Without printers everything is 0.
 */
export function averagePrinter(printers: readonly PrinterCost[]): PrinterCost {
  if (!printers.length) return { costPesos: 0, lifeHours: 1, maintenancePerHour: 0, kw: 0 };
  const avg = (f: (p: PrinterCost) => number) => printers.reduce((a, p) => a + f(p), 0) / printers.length;
  return { costPesos: avg((p) => p.costPesos / p.lifeHours + p.maintenancePerHour), lifeHours: 1, maintenancePerHour: 0, kw: avg((p) => p.kw) };
}

export function costProduct(p: ProductCostInput, printers: readonly PrinterCost[], s: CostSettings): CostBreakdown {
  const printer = p.printer ?? averagePrinter(printers);
  const h = p.hours || 0;
  const M = p.filaments.reduce((a, f) => a + (f.grams || 0) * f.costPerGram * (1 + s.purgePct / 100), 0);
  const L = h * printer.kw * s.kwhPrice;
  const Q = h * (printer.costPesos / (printer.lifeHours || 1) + printer.maintenancePerHour);
  const E = (p.extras || 0) + p.supplies.reduce((a, x) => a + (x.qty || 0) * (x.unitCost || 0), 0);
  const sub = M + L + Q + E;
  const total = sub / (1 - s.failurePct / 100);
  return { M, L, Q, E, sub, F: total - sub, total };
}
