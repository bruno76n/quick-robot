// Typed client for Compras (docs/12 › Compras). Shapes mirror purchases() in packages/server/src/usecases/sell/reports.ts.
import { useQuery } from '@tanstack/react-query';
import { request } from '../../lib/api';
import { keys } from '../../lib/queries';

export interface PurchaseLine {
  kind: 'filament' | 'supply'; id: string; qty: number; estimatedCents: number; supplierId: string | null; reason: 'order' | 'low'; name: string; hex: string | null;
  unit: string; brand: string; missingGrams: number; remainingGrams: number; orderNumbers: number[]; urgent: boolean; stock?: number; minimum?: number;
}
export interface PurchaseGroup { supplierId: string | null; supplier: { id: string; name: string; phone: string; note: string } | null; lines: PurchaseLine[]; estimatedCents: number }
export interface RecentPurchase { kind: 'filament' | 'supply'; id: string; on: string; name: string; brand: string; qty: number; unit: string; amountCents: number }
export interface Purchases { groups: PurchaseGroup[]; estimatedCents: number; count: number; urgent: number; recent: RecentPurchase[] }

export const purchasesApi = { get: (signal?: AbortSignal) => request<Purchases>('GET', '/purchases', undefined, signal) };
export const usePurchases = () => useQuery({ queryKey: keys.purchases, queryFn: async ({ signal }) => (await purchasesApi.get(signal)).data });
