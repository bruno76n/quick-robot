/**
 * Supplies (docs/04 §9) — mockup `stockIns`, `insEstado`, `ivCompraDlg`, `ivUsoDlg`.
 * stock = Σ movements (purchase, use, adjustment, waste). Never stored.
 */
import { round2 } from './money';

export type SupplyMovementKind = 'purchase' | 'use' | 'adjustment' | 'waste';
export type SupplyStatus = 'out' | 'low' | 'enough';

export function supplyStock(movements: readonly { qty: number }[]): number {
  return movements.reduce((t, m) => t + m.qty, 0);
}

/** "Agotado" if ≤ 0; "Poco" if ≤ minimum; else "Suficiente". */
export function supplyStatus(stock: number, minimum: number): SupplyStatus {
  return stock <= 0 ? 'out' : stock <= minimum ? 'low' : 'enough';
}

/** Unit cost after a purchase: total paid / quantity, rounded to cents. Without a total the cost stays. */
export function unitCostAfterPurchase(currentCost: number, qty: number, totalPaid: number | null | undefined): number {
  return totalPaid != null && totalPaid > 0 && qty > 0 ? round2(totalPaid / qty) : currentCost;
}

export type SupplyMovementPlan = { ok: true; delta: number } | { ok: false; reason: 'invalid_qty' | 'no_change' | 'insufficient' };

/**
 * "Usar o ajustar": `use`/`waste` take `qty` out; `adjustment` sets the real count (delta = count − stock).
 * A movement can never take more than there is.
 */
export function planSupplyMovement(kind: 'use' | 'waste' | 'adjustment', qty: number, stock: number): SupplyMovementPlan {
  if (!Number.isFinite(qty) || qty < 0 || (kind !== 'adjustment' && qty <= 0)) return { ok: false, reason: 'invalid_qty' };
  const delta = kind === 'adjustment' ? qty - stock : -qty;
  if (!delta) return { ok: false, reason: 'no_change' };
  if (delta < 0 && -delta > stock + 1e-9) return { ok: false, reason: 'insufficient' };
  return { ok: true, delta };
}

/** Value of what is left: max(0, stock) × unit cost. */
export const supplyValue = (stock: number, unitCost: number): number => Math.max(0, stock) * unitCost;
