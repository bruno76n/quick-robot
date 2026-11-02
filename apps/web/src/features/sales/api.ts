// Ventas client (docs/12 §6). Types mirror packages/server/src/usecases/sell/sales.ts.
import type { PaymentInput, ReturnSaleInput, SaleInput, SalePatch } from '@app/contract';
import { qs, request } from '../../lib/api';

export interface SaleListItem {
  id: string; on: string; channelId: string; channel: string; customerId: string | null; customer: string; itemsText: string; note: string;
  totalCents: number; incomeCents: number; costCents: number; commissionCents: number; profitCents: number; owedCents: number;
  returned: boolean; orderId: string | null; orderNumber: number | null; pieces: number; listCents: number;
  items: { kind: 'piece' | 'set'; name: string; qty: number; parts: { name: string; qty: number }[] }[];
}
export interface SaleTotals { count: number; incomeCents: number; profitCents: number; costCents: number; owedCents: number }
export interface SalePage { items: SaleListItem[]; page: number; pageSize: number; total: number; totals: SaleTotals }

export interface SalePart { productId: string; name: string; qty: number; listCents: number; costCents: number }
export interface SaleItem {
  id: string; kind: 'piece' | 'set'; productId: string | null; collectionId: string | null; name: string; qty: number;
  priceCents: number; listCents: number; costCents: number; extrasCents: number; totalCents: number; parts: SalePart[];
}
export interface SaleReturn { on: string; restock: boolean; refundCents: number; note: string }
export interface SaleDetail {
  id: string; on: string; channelId: string; channel: string; commissionPct: number; customerId: string | null; customer: string;
  orderId: string | null; orderNumber: number | null; note: string; tracksPayments: boolean; return: SaleReturn | null;
  items: SaleItem[]; payments: { id: string; on: string; amountCents: number; note: string }[];
  totals: { grossCents: number; incomeCents: number; commissionCents: number; costCents: number; profitCents: number; paidCents: number; owedCents: number };
}

/** The part of a report the Ventas summary uses (docs/12 §8). */
export interface ReportConcepts {
  totals: { incomeCents: number; costCents: number; commissionCents: number; profitCents: number };
  costConcepts: { materialCents: number; powerCents: number; machineCents: number; extrasCents: number; failureReserveCents: number };
}

export const salesApi = {
  list: (p: { from?: string; to?: string; channelId?: string; customerId?: string; pageSize?: number }) => request<SalePage>('GET', `/sales${qs(p)}`),
  get: (id: string) => request<SaleDetail>('GET', `/sales/${id}`),
  create: (input: SaleInput) => request<SaleDetail>('POST', '/sales', input),
  update: (id: string, input: SalePatch) => request<SaleDetail>('PATCH', `/sales/${id}`, input),
  remove: (id: string) => request<void>('DELETE', `/sales/${id}`),
  restore: (id: string) => request<SaleDetail>('POST', `/sales/${id}/restore`),
  pay: (id: string, input: PaymentInput) => request<SaleDetail>('POST', `/sales/${id}/payments`, input),
  removePayment: (id: string, paymentId: string) => request<SaleDetail>('DELETE', `/sales/${id}/payments/${paymentId}`),
  giveBack: (id: string, input: ReturnSaleInput) => request<SaleDetail>('POST', `/sales/${id}/return`, input),
  concepts: (from: string, to: string) => request<ReportConcepts>('GET', `/reports${qs({ from, to })}`),
};
