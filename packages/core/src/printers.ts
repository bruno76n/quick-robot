// Printers (docs/04 §11): maintenance by hours and investment recovered.

export type MaintenanceStatus = 'ok' | 'soon' | 'due';
export const BASE_MAINTENANCE: readonly { task: string; everyHours: number }[] = [
  { task: 'Cambiar la boquilla', everyHours: 300 },
  { task: 'Lubricar ejes', everyHours: 200 },
  { task: 'Limpiar la cama', everyHours: 100 },
];
export const SOON_USAGE = 0.8;

/** remaining = last + every − hours; usage = clamp((hours − last)/every, 0, 1.2) (case 11.1). */
export function maintenanceState(task: { everyHours: number; lastHours: number }, printerHours: number) {
  const hours = printerHours || 0;
  const remaining = task.lastHours + task.everyHours - hours;
  const usage = Math.max(0, Math.min(1.2, (hours - task.lastHours) / Math.max(1, task.everyHours)));
  const status: MaintenanceStatus = remaining <= 0 ? 'due' : usage >= SOON_USAGE ? 'soon' : 'ok';
  return { remaining, usage, status };
}

/**
 * Net = max(0, gross profit − expenses) since always, split among printers by their hours;
 * recovered % = min(100, contribution / cost × 100) (case 11.2).
 */
export function investmentRecovered(grossProfit: number, expenses: number, printers: readonly { id: string; costPesos: number; hours: number }[]) {
  const equipment = printers.reduce((a, p) => a + (p.costPesos || 0), 0);
  const hours = printers.reduce((a, p) => a + (p.hours || 0), 0);
  const net = Math.max(0, grossProfit - expenses);
  const perPrinter = printers.map((p) => {
    const contribution = hours > 0 ? (net * (p.hours || 0)) / hours : 0;
    return { id: p.id, contribution, pct: p.costPesos > 0 ? Math.min(100, (contribution / p.costPesos) * 100) : 0 };
  });
  return { equipment, hours, net, recoveredPct: equipment > 0 ? Math.min(100, (net / equipment) * 100) : 0, perPrinter };
}
