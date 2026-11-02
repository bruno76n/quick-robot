// Typed client written by hand from packages/contract (docs/07). Same origin (/api/v1); in local mode the
// launch secret is added by Electron or the Vite proxy, never by this code.
import type { AddSpoolInput, AddSpoolOutput, ErrorCode, FilamentDetail, FilamentListItem, Page, Warning } from '@app/contract';

export type ClientCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(readonly code: ClientCode, readonly status: number, readonly details: Record<string, unknown> = {}, readonly errorId?: string) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface Result<T> { data: T; warnings: Warning[] }

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'same-origin',
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('NETWORK_ERROR', 0);
  }
  if (res.status === 204) return { data: undefined as T, warnings: [] };
  let json: { data?: T; warnings?: Warning[]; code?: ErrorCode; details?: Record<string, unknown>; errorId?: string } = {};
  try { json = await res.json(); } catch { /* not JSON: handled below */ }
  if (!res.ok) throw new ApiError(json.code ?? (res.status >= 500 ? 'INTERNAL_ERROR' : 'NETWORK_ERROR'), res.status, json.details ?? {}, json.errorId);
  return { data: json.data as T, warnings: json.warnings ?? [] };
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
};

export const api = {
  me: () => request<{ user: { id: string }; workspace: { id: string; name: string }; role: string }>('GET', '/me'),
  health: () => request<{ ok: boolean; version: string; schemaVersion: number }>('GET', '/health'),
  filaments: {
    list: (p: { q?: string; page?: number; pageSize?: number } = {}, signal?: AbortSignal) => request<Page<FilamentListItem>>('GET', `/filaments${qs(p)}`, undefined, signal),
    get: (id: string) => request<FilamentDetail>('GET', `/filaments/${encodeURIComponent(id)}`),
  },
  spools: {
    add: (input: AddSpoolInput) => request<AddSpoolOutput>('POST', '/spools', input),
  },
};
