// Productos by families (docs/12 §5 GET /products): pages of 50 families, "Ver más" loads the next one.
import type { ProductFamilyFilter } from '@app/contract';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { keys } from '../../lib/queries';

export const FAMILY_PAGE_SIZE = 50;

export function useProductFamilies(q: string, filter: ProductFamilyFilter) {
  return useInfiniteQuery({
    queryKey: [...keys.products, 'families', q, filter],
    queryFn: async ({ pageParam }) => (await api.products.list({ q, filter, page: pageParam, pageSize: FAMILY_PAGE_SIZE })).data,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
}

/** Where every "+ Variante" goes: the calculator with a copy of the original (mejoras/ronda-2.md §3.4). */
export const newVariantPath = (rootId: string) => `/productos/pieza?variante=${encodeURIComponent(rootId)}`;
export const sellPath = (id: string, free: number) => `/armar?modo=${free > 0 ? 'venta' : 'pedido'}&pieza=${id}`;
