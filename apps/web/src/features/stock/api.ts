// Client for Existencias (docs/12 › Producción y existencias). The list follows the `stockPage` schema of packages/contract.
import type { StockMember, StockPage, StockQuery, StockRow } from '@app/contract';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { qs, request } from '../../lib/api';
import { keys } from '../../lib/queries';

export type { StockMember, StockPage, StockRow };
export type StockStatus = StockRow['status'];
export type StockFilter = StockQuery['status'];
export type StockSort = StockQuery['sort'];
export interface StockLevel { physical: number; reserved: number; free: number; status: StockStatus }
export type StockMovementKind = 'initial' | 'print' | 'order_print' | 'sale' | 'return' | 'delivery' | 'adjustment';
export interface StockDetail extends StockLevel {
  productId: string; name: string; tracksStock: boolean; photoUrl: string | null; listCents: number; costCents: number;
  reservedBy: { orderId: string; number: number; status: string; customer: string; qty: number }[];
  movements: { id: string; on: string; kind: StockMovementKind; qty: number; note: string; refId: string | null }[];
}
export interface StockListParams { q?: string; status?: StockFilter; sort?: StockSort; page?: number; pageSize?: number }

export const STOCK_PAGE_SIZE = 100;

export const stockApi = {
  list: (p: StockListParams = {}, signal?: AbortSignal) => request<StockPage>('GET', `/stock${qs({ ...p })}`, undefined, signal),
  get: (productId: string) => request<StockDetail>('GET', `/stock/${encodeURIComponent(productId)}`),
  enable: (productId: string, initialCount: number) => request<StockDetail>('POST', `/stock/${encodeURIComponent(productId)}/enable`, { initialCount }),
  adjust: (productId: string, input: { mode: 'count' | 'delta'; value: number; note?: string }) => request<StockDetail>('POST', `/stock/${encodeURIComponent(productId)}/adjust`, input),
};

/** Families with stock, filtered and ordered by the server; more pages with "Ver más". */
export const useStock = (p: { q: string; status: StockFilter; sort: StockSort }) => useInfiniteQuery({
  queryKey: [...keys.stock, 'list', p],
  queryFn: async ({ pageParam, signal }) => (await stockApi.list({ ...p, page: pageParam, pageSize: STOCK_PAGE_SIZE }, signal)).data,
  initialPageParam: 1,
  getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  placeholderData: keepPreviousData,
});
export const useStockDetail = (id: string | null) => useQuery({ queryKey: [...keys.stock, 'detail', id], queryFn: async () => (await stockApi.get(id!)).data, enabled: Boolean(id) });
