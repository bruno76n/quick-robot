// Test builders (docs/14 §3): defaults follow case 2.1 where it applies; never touch a clock or a database.
import type { SpoolInput } from '../src/filament';

let n = 0;
export function aSpool(over: Partial<SpoolInput> = {}): SpoolInput {
  n += 1;
  return { id: `s${String(n).padStart(3, '0')}`, purchasedOn: '2026-10-01', grams: 1000, costPesos: 450, shippingPesos: 50, remaining: 1000, ...over };
}
