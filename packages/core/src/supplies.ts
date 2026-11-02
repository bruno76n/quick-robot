// Supplies (docs/04 §9): stock is the sum of the ledger; status by minimum.
export type SupplyStatus = 'out' | 'low' | 'ok';

export function supplyStatus(stock: number, minimum: number): SupplyStatus {
  if (stock <= 0) return 'out';
  if (stock <= minimum) return 'low';
  return 'ok';
}

/** "Uso o ajuste" by count: the difference to record so the ledger reaches the real count. */
export function countDelta(current: number, counted: number): number {
  return counted - current;
}
