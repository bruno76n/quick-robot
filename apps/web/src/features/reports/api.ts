// Typed client for Reportes and Inicio (docs/12 §9). Types mirror packages/server/src/usecases/sell/reports.ts.
import type { Attention } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { qs, request } from '../../lib/api';
import { keys } from '../../lib/queries';

export type ApiPeriod = '7' | '30' | '90' | 'all';
export interface Totals { incomeCents: number; commissionCents: number; costCents: number; profitCents: number; pieces: number; marginPct: number; count: number; listCents: number; discountCents: number }
export interface Bucket { from: string; to: string; partial: boolean; incomeCents: number; costCents: number; commissionCents: number; profitCents: number; count: number; pieces: number }
export interface CostConcepts { materialCents: number; powerCents: number; machineCents: number; extrasCents: number; failureReserveCents: number }
export interface Report {
  range: { from: string; to: string; days: number; unit: 'day' | 'week' | 'month'; period: string };
  totals: Totals; previous: Totals | null;
  byChannel: (Totals & { channelId: string; name: string; commissionPct: number })[];
  topProducts: { productId: string; name: string; hexes: string[]; qty: number; incomeCents: number; costCents: number; profitCents: number; times: number }[];
  byCollection: { id: string; name: string; qty: number; incomeCents: number; costCents: number; profitCents: number }[];
  byCustomer: { id: string | null; name: string; count: number; incomeCents: number; profitCents: number; owedCents: number }[];
  costConcepts: CostConcepts; buckets: Bucket[]; expensesCents: number; netProfitCents: number;
  investmentRecovered: { equipmentCents: number; hours: number; netCents: number; recoveredPct: number };
  periodSales: number; hasExpenses: boolean; previousExpensesCents: number | null;
  workshop: {
    filaments: { filamentId: string; name: string; hex: string; grams: number }[]; usedGrams: number; lostGrams: number; runs: number; failures: number; failurePct: number;
    printers: { id: string; name: string; runs: number; hours: number; failures: number; costPerHourCents: number }[];
  };
  inventory: { pieces: number; free: number; reserved: number; atCostCents: number; atListCents: number; grams: number; valueCents: number; spools: number };
  ordersNow: { active: number; inProduction: number; ready: number; totalCents: number; paidCents: number; owedCents: number; profitCents: number; quotes: number; quotesCents: number };
}

export type { Attention, AttentionSeverity } from '@app/contract';
export type AttentionKind = Attention['kind'];
export interface Home {
  stats: { incomeCents: number; profitCents: number; marginPct: number; sales: number; pieces: number; activeOrders: number; owedCents: number; inProduction: number; ready: number; printersBusy: number; printers: number; products: number };
  printingNow: { printerId: string; printer: string; id: string; orderId: string; orderNumber: number; text: string; minutes: number; remainingMinutes: number; progress: number; customer: string }[];
  attentions: Attention[];
  upcoming: { id: string; number: number; customer: string; status: string; dueOn: string; itemsText: string; owedCents: number }[];
}

export const reportsApi = {
  report: (period: ApiPeriod) => request<Report>('GET', `/reports${qs({ period })}`),
  home: () => request<Home>('GET', '/home'),
};

export const useReport = (period: ApiPeriod) => useQuery({ queryKey: [...keys.reports, period], queryFn: async () => (await reportsApi.report(period)).data });
export const useHome = () => useQuery({ queryKey: keys.home, queryFn: async () => (await reportsApi.home()).data });
