// Typed client for Gastos (docs/12 §9). Types mirror packages/server/src/usecases/sell/reports.ts › expenseList.
import type { ExpenseInput } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { qs, request } from '../../lib/api';
import { keys } from '../../lib/queries';

export interface ExpenseView { id: string; on: string; concept: string; category: string; amountCents: number; recurring: boolean; endsOn: string | null; inPeriodCents: number }
export interface ExpenseList { items: ExpenseView[]; page: number; pageSize: number; total: number; periodTotalCents: number; fixedPerMonthCents: number; byCategory: { category: string; cents: number }[] }

export const expensesApi = {
  list: (p: { from?: string | undefined; to?: string | undefined; page?: number }) => request<ExpenseList>('GET', `/expenses${qs({ ...p, pageSize: 200 })}`),
  create: (input: ExpenseInput) => request<ExpenseView>('POST', '/expenses', input),
  update: (id: string, input: ExpenseInput) => request<ExpenseView>('PATCH', `/expenses/${id}`, input),
  remove: (id: string) => request<void>('DELETE', `/expenses/${id}`),
  restore: (id: string) => request<ExpenseView>('POST', `/expenses/${id}/restore`),
};

/** All expenses in a range (the server pages by 200; the business has few). */
export async function allExpenses(from?: string, to?: string): Promise<ExpenseList> {
  const first = (await expensesApi.list({ from, to })).data;
  const items = [...first.items];
  for (let page = 2; items.length < first.total; page++) {
    const next = (await expensesApi.list({ from, to, page })).data;
    if (!next.items.length) break;
    items.push(...next.items);
  }
  return { ...first, items };
}

export const useExpenses = (from?: string, to?: string) => useQuery({ queryKey: [...keys.expenses, from ?? '', to ?? ''], queryFn: () => allExpenses(from, to) });
