// Typed client for Existencias (docs/12 › Producción y existencias). Shapes mirror packages/server/src/usecases/sell/stock.ts.
import { useQuery } from '@tanstack/react-query';
import { request } from '../../lib/api';
import { keys } from '../../lib/queries';

export type StockStatus = 'out' | 'all_reserved' | 'few' | 'ok';
export interface StockLevel { physical: number; reserved: number; free: number; status: StockStatus }
export interface StockItem extends StockLevel { productId: string; name: string; photoUrl: string | null; hexes: string[]; listCents: number; costCents: number }
export interface StockList { items: StockItem[]; totals: { physical: number; free: number; reserved: number }; untracked: { id: string; name: string }[]; sets: { id: string; name: string; buildableSets: number | null }[] }
export type StockMovementKind = 'initial' | 'print' | 'order_print' | 'sale' | 'return' | 'delivery' | 'adjustment';
export interface StockDetail extends StockLevel {
  productId: string; name: string; tracksStock: boolean; photoUrl: string | null; listCents: number; costCents: number;
  reservedBy: { orderId: string; number: number; status: string; customer: string; qty: number }[];
  movements: { id: string; on: string; kind: StockMovementKind; qty: number; note: string; refId: string | null }[];
}

export const stockApi = {
  list: (signal?: AbortSignal) => request<StockList>('GET', '/stock', undefined, signal),
  get: (productId: string) => request<StockDetail>('GET', `/stock/${encodeURIComponent(productId)}`),
  enable: (productId: string, initialCount: number) => request<StockDetail>('POST', `/stock/${encodeURIComponent(productId)}/enable`, { initialCount }),
  adjust: (productId: string, input: { mode: 'count' | 'delta'; value: number; note?: string }) => request<StockDetail>('POST', `/stock/${encodeURIComponent(productId)}/adjust`, input),
};

export const useStock = () => useQuery({ queryKey: [...keys.stock, 'list'], queryFn: async ({ signal }) => (await stockApi.list(signal)).data });
export const useStockDetail = (id: string | null) => useQuery({ queryKey: [...keys.stock, 'detail', id], queryFn: async () => (await stockApi.get(id!)).data, enabled: Boolean(id) });
