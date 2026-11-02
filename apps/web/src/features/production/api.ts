// Typed client for Producción (docs/12 › Producción y existencias). Shapes mirror packages/server/src/usecases/sell/production.ts.
import { useQuery } from '@tanstack/react-query';
import { qs, request } from '../../lib/api';
import { keys } from '../../lib/queries';

export type PrintRunReason = 'stock' | 'order' | 'test';
export interface PrintRunView {
  id: string; on: string; productId: string | null; name: string; text: string; qty: number; printerId: string | null; printerName: string | null;
  result: 'ok' | 'fail'; hours: number; reason: PrintRunReason; orderId: string | null; orderNumber: number | null; photoUrl: string | null; grams: number;
  filaments: { filamentId: string; name: string; hex: string; grams: number }[];
}
export interface PrintRunDetail extends PrintRunView {
  piecesAdded: number; returnGrams: number; lock: { reason: 'order_history' | 'pieces_unavailable'; pieces: number } | null;
}
export interface PrintRunList { items: PrintRunView[]; page: number; pageSize: number; total: number; totals: { pieces: number; hours: number; grams: number; failed: number } }
export interface PrintRunInput {
  on: string; productId?: string | null; text?: string; qty: number; printerId?: string | null; result: 'ok' | 'fail'; hours: number; reason: PrintRunReason;
  filaments: { filamentId: string; grams: number }[]; photoFileId?: string | null;
}

export const productionApi = {
  list: (signal?: AbortSignal) => request<PrintRunList>('GET', `/print-runs${qs({ pageSize: 200 })}`, undefined, signal),
  get: (id: string) => request<PrintRunDetail>('GET', `/print-runs/${encodeURIComponent(id)}`),
  create: (input: PrintRunInput) => request<PrintRunDetail>('POST', '/print-runs', input),
  remove: (id: string) => request<null>('DELETE', `/print-runs/${encodeURIComponent(id)}`),
};

export const usePrintRuns = () => useQuery({ queryKey: [...keys.printRuns, 'list'], queryFn: async ({ signal }) => (await productionApi.list(signal)).data });
export const usePrintRun = (id: string | null) => useQuery({ queryKey: [...keys.printRuns, 'detail', id], queryFn: async () => (await productionApi.get(id!)).data, enabled: Boolean(id) });
