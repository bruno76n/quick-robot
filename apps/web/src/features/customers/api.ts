// Clientes client (docs/12 §9). Types mirror packages/server/src/usecases/sell/customers.ts.
import type { CustomerInput, CustomerPatch, OrderStatusValue } from '@app/contract';
import { request } from '../../lib/api';

export interface CustomerTotals { orders: number; activeOrders: number; sales: number; incomeCents: number; profitCents: number; owedCents: number; lastActivity: string }
export interface CustomerView {
  id: string; name: string; type: string; phone: string; note: string; hasLogo: boolean; logoUrl: string | null; logoFileId: string | null; createdOn: string;
}
export type CustomerListItem = CustomerView & CustomerTotals;
export type HistoryRow =
  | { kind: 'order'; id: string; number: number; on: string; dueOn: string; status: OrderStatusValue; itemsText: string; totalCents: number; owedCents: number }
  | { kind: 'sale'; id: string; on: string; itemsText: string; totalCents: number; grossCents: number; profitCents: number; owedCents: number; returned: boolean; orderId: string | null };
export interface CustomerDetail extends CustomerView { totals: CustomerTotals; history: HistoryRow[] }

export const customersApi = {
  list: () => request<CustomerListItem[]>('GET', '/customers'),
  get: (id: string) => request<CustomerDetail>('GET', `/customers/${id}`),
  create: (input: CustomerInput) => request<CustomerDetail>('POST', '/customers', input),
  update: (id: string, input: CustomerPatch) => request<CustomerDetail>('PATCH', `/customers/${id}`, input),
  removeLogo: (id: string) => request<CustomerDetail>('DELETE', `/customers/${id}/logo`),
  remove: (id: string) => request<void>('DELETE', `/customers/${id}`),
  restore: (id: string) => request<CustomerDetail>('POST', `/customers/${id}/restore`),
};
