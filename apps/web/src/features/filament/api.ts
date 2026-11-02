import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddSpoolInput } from '@app/contract';
import { api } from '../../lib/api';

export const filamentKeys = {
  all: ['filaments'] as const,
  list: () => [...filamentKeys.all, 'list'] as const,
  detail: (id: string) => [...filamentKeys.all, 'detail', id] as const,
};

export const useFilaments = () => useQuery({ queryKey: filamentKeys.list(), queryFn: api.filaments.list });

export const useFilament = (id: string | undefined) =>
  useQuery({ queryKey: filamentKeys.detail(id ?? ''), queryFn: () => api.filaments.get(id!), enabled: !!id });

/** addSpool touches the filament list and that filament's detail. */
export function useAddSpool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddSpoolInput) => api.filaments.addSpool(input),
    onSuccess: (result) => {
      qc.setQueryData(filamentKeys.detail(result.filament.id), result.filament);
      return qc.invalidateQueries({ queryKey: filamentKeys.list() });
    },
  });
}
