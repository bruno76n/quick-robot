/**
 * Printers (docs/04 §11) — mockup `MANT_BASE`, `mantEstado`, `inversion`.
 */

export interface MaintenanceTaskFacts {
  everyHours: number;
  lastHours: number;
}

export type MaintenanceStatus = 'due' | 'soon' | 'ok';

/**
 * remaining = last + every − current; usage = clamp((current − last)/every, 0, 1.2).
 * remaining ≤ 0 → "Toca ya" (due); usage ≥ 0.8 → "Pronto" (soon); else "Al corriente" (ok).
 */
export function maintenanceStatus(currentHours: number, t: MaintenanceTaskFacts): { remaining: number; usage: number; status: MaintenanceStatus } {
  const h = currentHours || 0;
  const remaining = t.lastHours + t.everyHours - h;
  const usage = Math.max(0, Math.min(1.2, (h - t.lastHours) / Math.max(1, t.everyHours)));
  return { remaining, usage, status: remaining <= 0 ? 'due' : usage >= 0.8 ? 'soon' : 'ok' };
}

/** Base tasks of a new printer: nozzle every 300 h, axes every 200 h, bed every 100 h (generic defaults, editable). */
export const BASE_MAINTENANCE_TASKS: readonly { task: string; everyHours: number }[] = [
  { task: 'Cambiar la boquilla', everyHours: 300 },
  { task: 'Lubricar ejes', everyHours: 200 },
  { task: 'Limpiar la cama', everyHours: 100 },
];

export interface InvestmentRecovery {
  equipment: number;
  hours: number;
  net: number;
  /** % of all equipment recovered. */
  recoveredPct: number;
  perPrinter: { id: string; contribution: number; pct: number }[];
}

/**
 * Investment recovered: net = max(0, gross profit − expenses) since always, split among printers by their
 * hours; % recovered = min(100, contribution / cost × 100).
 */
export function investmentRecovery(grossProfit: number, expenses: number, printers: readonly { id: string; cost: number; hours: number }[]): InvestmentRecovery {
  const equipment = printers.reduce((t, p) => t + (p.cost || 0), 0);
  const hours = printers.reduce((t, p) => t + (p.hours || 0), 0);
  const net = Math.max(0, grossProfit - expenses);
  const perPrinter = printers.map((p) => {
    const contribution = hours > 0 ? (net * (p.hours || 0)) / hours : 0;
    return { id: p.id, contribution, pct: p.cost > 0 ? Math.min(100, (contribution / p.cost) * 100) : 0 };
  });
  return { equipment, hours, net, recoveredPct: equipment > 0 ? Math.min(100, (net / equipment) * 100) : 0, perPrinter };
}
