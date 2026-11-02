// What the builder sends and reads (docs/12 §6–7). Types mirror packages/server/src/usecases/sell/orders.ts.
import type { OrderInput, OrderUpdateInput, SaleInput } from '@app/contract';
import { request } from '../../lib/api';
import type { SaleDetail } from '../sales/api';

export interface OrderForEdit {
  id: string; number: number; status: string; customerId: string; channelId: string; note: string; createdOn: string; dueOn: string;
  items: { id: string; kind: 'piece' | 'set'; productId: string | null; collectionId: string | null; qty: number; priceCents: number; fromStock: Record<string, number>; freeNow: Record<string, number> }[];
  totals: { totalCents: number };
}

export const builderApi = {
  order: (id: string) => request<OrderForEdit>('GET', `/orders/${id}`),
  createSale: (input: SaleInput) => request<SaleDetail>('POST', '/sales', input),
  createOrder: (input: OrderInput) => request<OrderForEdit>('POST', '/orders', input),
  updateOrder: (id: string, input: OrderUpdateInput) => request<OrderForEdit>('PUT', `/orders/${id}`, input),
};
