// Shared queries and the invalidation map of docs/12 ("Invalidan").
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  settings: ['settings'] as const, filaments: ['filaments'] as const, supplies: ['supplies'] as const, suppliers: ['suppliers'] as const,
  printers: ['printers'] as const, products: ['products'] as const, collections: ['collections'] as const, me: ['me'] as const,
  stock: ['stock'] as const, customers: ['customers'] as const, sales: ['sales'] as const, orders: ['orders'] as const, printRuns: ['printRuns'] as const,
  expenses: ['expenses'] as const, reports: ['reports'] as const, home: ['home'] as const, purchases: ['purchases'] as const, search: ['search'] as const,
};

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: async () => (await api.settings.get()).data });
export const useSupplies = () => useQuery({ queryKey: [...keys.supplies, 'list'], queryFn: async ({ signal }) => (await api.supplies.list(signal)).data });
export const useSuppliers = () => useQuery({ queryKey: keys.suppliers, queryFn: async () => (await api.suppliers.list()).data });
export const usePrinters = () => useQuery({ queryKey: keys.printers, queryFn: async () => (await api.printers.list()).data });
export const useProducts = () => useQuery({ queryKey: [...keys.products, 'list'], queryFn: async () => (await api.products.list()).data });
export const useCollections = () => useQuery({ queryKey: [...keys.collections, 'list'], queryFn: async () => (await api.collections.list()).data });

/** After a write, reload what it touched (and what depends on costs). */
export function invalidate(qc: QueryClient, ...groups: (keyof typeof keys)[]) {
  return Promise.all(groups.map((g) => qc.invalidateQueries({ queryKey: keys[g] })));
}
