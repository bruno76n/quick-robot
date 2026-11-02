// TanStack Query hooks for filaments. After a write, invalidate what it touched (docs/07, docs/12 "Invalidan").
import type { AddSpoolInput } from '@app/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const filamentKeys = { all: ['filaments'] as const, list: () => ['filaments', 'list'] as const, detail: (id: string) => ['filaments', 'detail', id] as const };

/** Filaments are a small catalog that feeds selectors: loaded whole (docs/15 §3.1). */
export function useFilaments() {
  return useQuery({ queryKey: filamentKeys.list(), queryFn: async ({ signal }) => (await api.filaments.list({ pageSize: 200 }, signal)).data });
}

export function useFilament(id: string | null) {
  return useQuery({ queryKey: filamentKeys.detail(id ?? ''), queryFn: async () => (await api.filaments.get(id!)).data, enabled: Boolean(id) });
}

export function useAddSpool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddSpoolInput) => (await api.spools.add(input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: filamentKeys.all }),
  });
}
