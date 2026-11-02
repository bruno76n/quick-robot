// Query keys and hooks shared by several screens. After each operation the screen invalidates what the
// use case touched (docs/07 › Principios 3).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  settings: ['settings'] as const,
  catalog: ['catalog'] as const,
  filaments: ['filaments'] as const,
  supplies: ['supplies'] as const,
  printers: ['printers'] as const,
  products: ['products'] as const,
  costing: ['costing'] as const,
};

export type Area = keyof typeof keys;

/** What each kind of write affects (costs depend on settings, printers, filaments and supplies). */
export const touches: Record<'settings' | 'spools' | 'supplies' | 'printers' | 'products', Area[]> = {
  settings: ['settings', 'printers', 'products', 'costing'],
  spools: ['filaments', 'catalog', 'products', 'costing'],
  supplies: ['supplies', 'products', 'costing'],
  printers: ['printers', 'products', 'costing', 'settings'],
  products: ['products', 'supplies', 'costing'],
};

export function useInvalidate() {
  const qc = useQueryClient();
  return (kind: keyof typeof touches) => Promise.all(touches[kind].map((a) => qc.invalidateQueries({ queryKey: keys[a] })));
}

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: api.settings.get });
export const useCatalog = () => useQuery({ queryKey: keys.catalog, queryFn: api.settings.catalog });
export const usePrinters = () => useQuery({ queryKey: keys.printers, queryFn: api.printers.list });
export const useSupplies = () => useQuery({ queryKey: keys.supplies, queryFn: api.supplies.list });
export const useCatalogue = () => useQuery({ queryKey: keys.products, queryFn: api.products.catalogue });
export const useCostingContext = () => useQuery({ queryKey: keys.costing, queryFn: api.products.costingContext });
