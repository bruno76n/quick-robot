// Typed client of Pedidos (docs/12 §7), written by hand from packages/server/src/usecases/sell/orders.ts.
import type { Page } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { qs, request } from '../../lib/api';
import { keys } from '../../lib/queries';

export type OrderStatus = 'quoted' | 'accepted' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type OrderStep = 'accept' | 'start_production' | 'ready' | 'deliver';

export interface PartRef { productId: string; name: string; qty: number }
export interface ListJob { printerId: string; printerName: string; progress: number; remainingMinutes: number; waitMinutes: number; position: number }
export interface OrderListItem {
  id: string; number: number; customerId: string; customer: string; status: OrderStatus; createdOn: string; dueOn: string; readyOn: string | null; deliveredOn: string | null;
  channel: string; itemsText: string; totalCents: number; paidCents: number; owedCents: number; profitCents: number;
  origins: { fromStock: number; toPrint: number }; queueProgress: number | null; queueRemainingMinutes: number | null; nextStep: OrderStep | null;
  items: { kind: 'piece' | 'set'; productId: string | null; name: string; qty: number; totalCents: number; parts: PartRef[]; fromStock: Record<string, number>; printerId: string | null }[];
  jobs: ListJob[];
}

export interface OrderPart { productId: string; name: string; qty: number; listCents: number; costCents: number }
export interface OrderItem {
  id: string; kind: 'piece' | 'set'; productId: string | null; collectionId: string | null; name: string; qty: number; priceCents: number; listCents: number; costCents: number;
  extrasCents: number; totalCents: number; parts: OrderPart[]; fromStock: Record<string, number>; toPrint: number; printerId: string | null; printerName: string | null;
}
export interface OrderQueueEntry {
  id: string; orderId: string; orderNumber: number; text: string; minutes: number; startedAt: string | null; remainingMinutes: number; progress: number; waitMinutes: number;
  position: number; printerId: string; printerName: string;
}
export interface OrderDetail {
  id: string; number: number; status: OrderStatus; customerId: string; customer: { id: string; name: string; phone: string; type: string; hasLogo: boolean; logoUrl: string | null } | null;
  channelId: string; channel: string; commissionPct: number; note: string; createdOn: string; dueOn: string; productionOn: string | null; readyOn: string | null; deliveredOn: string | null;
  filamentDeducted: boolean; runsLogged: boolean; stockReserved: Record<string, number> | null; cancellation: { on: string; reason: string; refundCents: number } | null;
  items: OrderItem[]; payments: { id: string; on: string; amountCents: number; note: string }[];
  totals: { totalCents: number; commissionCents: number; costCents: number; profitCents: number; paidCents: number; owedCents: number };
  queue: OrderQueueEntry[]; material: { needs: { filamentId: string; grams: number }[]; shortfall: unknown[] }; nextStep: OrderStep | null;
}

const enc = encodeURIComponent;
export const ordersApi = {
  list: (p: { view?: 'board' | 'list' | 'calendar'; month?: string; status?: string; pageSize?: number }) => request<Page<OrderListItem>>('GET', `/orders${qs({ ...p, pageSize: p.pageSize ?? 200 })}`),
  get: (id: string) => request<OrderDetail>('GET', `/orders/${enc(id)}`),
  accept: (id: string) => request<OrderDetail>('POST', `/orders/${enc(id)}/accept`),
  start: (id: string, input: { assignments: { lineItemId: string; printerId: string }[]; deductFilament: boolean }) => request<OrderDetail>('POST', `/orders/${enc(id)}/start-production`, input),
  reassign: (id: string, input: { assignments: { lineItemId: string; printerId: string }[] }) => request<OrderDetail>('POST', `/orders/${enc(id)}/reassign-printers`, input),
  ready: (id: string) => request<OrderDetail>('POST', `/orders/${enc(id)}/ready`),
  deliver: (id: string, input: { on: string; collectCents?: number }) => request<{ order: OrderDetail; saleId: string }>('POST', `/orders/${enc(id)}/deliver`, input),
  cancel: (id: string, input: { reason: string; refundCents?: number }) => request<OrderDetail>('POST', `/orders/${enc(id)}/cancel`, input),
  pay: (id: string, input: { on: string; amountCents: number; note?: string }) => request<OrderDetail>('POST', `/orders/${enc(id)}/payments`, input),
  removePayment: (id: string, paymentId: string) => request<OrderDetail>('DELETE', `/orders/${enc(id)}/payments/${enc(paymentId)}`),
  remove: (id: string) => request<void>('DELETE', `/orders/${enc(id)}`),
  restore: (id: string) => request<OrderDetail>('POST', `/orders/${enc(id)}/restore`),
  finishJob: (printerId: string, entryId: string) => request<{ orderId: string; readyTriggered: boolean }>('POST', `/printers/${enc(printerId)}/queue/${enc(entryId)}/finish`),
};

export const useOrderList = (view: 'board' | 'list' | 'calendar', month?: string) =>
  useQuery({ queryKey: [...keys.orders, 'list', view, month ?? ''], queryFn: async () => (await ordersApi.list({ view, ...(month ? { month } : {}) })).data });
export const useOrder = (id: string | undefined) =>
  useQuery({ queryKey: [...keys.orders, 'detail', id], queryFn: async () => (await ordersApi.get(id!)).data, enabled: !!id, retry: false });

/** What every order write touches (docs/12 §7 "Invalidan"). */
export const ORDER_TOUCHES = ['orders', 'stock', 'printers', 'filaments', 'printRuns', 'sales', 'customers', 'reports', 'home', 'purchases', 'products', 'collections'] as const;

/** Mockup class names of each status (e-cotizado, …) and the chip tone. */
export const STATUS_CLASS: Record<OrderStatus, string> = { quoted: 'cotizado', accepted: 'aceptado', in_production: 'produccion', ready: 'listo', delivered: 'entregado', cancelled: 'cancelado' };
export const STATUS_TONE = { quoted: '', accepted: 'info', in_production: 'warn', ready: 'good', delivered: '', cancelled: 'bad' } as const;
export const STEPS: OrderStatus[] = ['quoted', 'accepted', 'in_production', 'ready', 'delivered'];
export const isActive = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';
