// Typed client written by hand from packages/contract (docs/07). Same origin (/api/v1); in local mode the
// launch secret is added by Electron or the Vite proxy, never by this code.
import type {
  AddChannelInput, AddSpoolInput, AddSpoolOutput, ChannelView, CollectionDetail, CollectionListItem, CompleteMaintenanceInput, CreateSupplyInput, ErrorCode,
  FilamentDetail, FilamentListItem, MaintenanceTaskInput, MaintenanceView, Page, PrinterInput, PrintersOutput, PrinterView, ProductDetail, ProductListItem,
  SaveCollectionInput, SaveProductInput, SettingsOutput, SettingsView, Spool, SpoolMovementInput, SupplierInput, SupplierView, SupplyDetail, SupplyListItem,
  SupplyMovementInput, SupplyPurchaseInput, UpdateChannelInput, UpdateSettingsInput, UpdateSpoolInput, UpdateSupplyInput, Warning,
} from '@app/contract';

export type ClientCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(readonly code: ClientCode, readonly status: number, readonly details: Record<string, unknown> = {}, readonly errorId?: string) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface Result<T> { data: T; warnings: Warning[] }

const BASE = '/api/v1';

/** Raw call for feature api.ts files (docs/07): same errors and warnings as `api`. */
export async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Result<T>> {
  let res: Response;
  const form = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body === undefined || form ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: form ? (body as FormData) : JSON.stringify(body) }),
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

export const qs = (p: Record<string, string | number | undefined>) => {
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
    update: (id: string, input: UpdateSpoolInput) => request<AddSpoolOutput>('PATCH', `/spools/${id}`, input),
    remove: (id: string) => request<{ movements: number }>('DELETE', `/spools/${id}`),
    restore: (id: string) => request<{ spool: Spool; filament: FilamentListItem }>('POST', `/spools/${id}/restore`),
    move: (id: string, input: SpoolMovementInput) => request<AddSpoolOutput>('POST', `/spools/${id}/movements`, input),
  },
  settings: {
    get: () => request<SettingsOutput>('GET', '/settings'),
    update: (input: UpdateSettingsInput) => request<SettingsView>('PATCH', '/settings', input),
    addChannel: (input: AddChannelInput) => request<ChannelView>('POST', '/channels', input),
    updateChannel: (id: string, input: UpdateChannelInput) => request<ChannelView>('PATCH', `/channels/${id}`, input),
    removeChannel: (id: string) => request<void>('DELETE', `/channels/${id}`),
  },
  suppliers: {
    list: () => request<SupplierView[]>('GET', '/suppliers'),
    create: (input: SupplierInput) => request<SupplierView>('POST', '/suppliers', input),
    update: (id: string, input: SupplierInput) => request<SupplierView>('PATCH', `/suppliers/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/suppliers/${id}`),
    restore: (id: string) => request<SupplierView>('POST', `/suppliers/${id}/restore`),
  },
  supplies: {
    list: (signal?: AbortSignal) => request<Page<SupplyListItem>>('GET', '/supplies?pageSize=200', undefined, signal),
    get: (id: string) => request<SupplyDetail>('GET', `/supplies/${id}`),
    create: (input: CreateSupplyInput) => request<SupplyDetail>('POST', '/supplies', input),
    update: (id: string, input: UpdateSupplyInput) => request<SupplyDetail>('PATCH', `/supplies/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/supplies/${id}`),
    restore: (id: string) => request<SupplyDetail>('POST', `/supplies/${id}/restore`),
    purchase: (id: string, input: SupplyPurchaseInput) => request<SupplyDetail>('POST', `/supplies/${id}/purchases`, input),
    move: (id: string, input: SupplyMovementInput) => request<SupplyDetail>('POST', `/supplies/${id}/movements`, input),
  },
  printers: {
    list: () => request<PrintersOutput>('GET', '/printers'),
    create: (input: PrinterInput) => request<PrinterView>('POST', '/printers', input),
    update: (id: string, input: PrinterInput) => request<PrinterView>('PATCH', `/printers/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/printers/${id}`),
    restore: (id: string) => request<PrinterView>('POST', `/printers/${id}/restore`),
    addTask: (id: string, input: MaintenanceTaskInput) => request<MaintenanceView>('POST', `/printers/${id}/maintenance`, input),
    updateTask: (id: string, taskId: string, input: MaintenanceTaskInput) => request<MaintenanceView>('PATCH', `/printers/${id}/maintenance/${taskId}`, input),
    removeTask: (id: string, taskId: string) => request<void>('DELETE', `/printers/${id}/maintenance/${taskId}`),
    completeTask: (id: string, taskId: string, input: CompleteMaintenanceInput) => request<{ task: MaintenanceView }>('POST', `/printers/${id}/maintenance/${taskId}/complete`, input),
  },
  products: {
    list: () => request<Page<ProductListItem>>('GET', '/products'),
    get: (id: string) => request<ProductDetail>('GET', `/products/${id}`),
    create: (input: SaveProductInput) => request<ProductDetail>('POST', '/products', input),
    update: (id: string, input: SaveProductInput) => request<ProductDetail>('PUT', `/products/${id}`, input),
    variant: (id: string, input: SaveProductInput) => request<ProductDetail>('POST', `/products/${id}/variant`, input),
    remove: (id: string) => request<void>('DELETE', `/products/${id}`),
    restore: (id: string) => request<ProductDetail>('POST', `/products/${id}/restore`),
  },
  collections: {
    list: () => request<Page<CollectionListItem>>('GET', '/collections'),
    get: (id: string) => request<CollectionDetail>('GET', `/collections/${id}`),
    create: (input: SaveCollectionInput) => request<CollectionDetail>('POST', '/collections', input),
    update: (id: string, input: SaveCollectionInput) => request<CollectionDetail>('PUT', `/collections/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/collections/${id}`),
    restore: (id: string) => request<CollectionDetail>('POST', `/collections/${id}/restore`),
  },
  files: {
    upload: (kind: 'product_photo' | 'customer_logo' | 'print_photo', file: Blob) => {
      const fd = new FormData();
      fd.set('kind', kind);
      fd.set('file', file);
      return request<{ fileId: string; url: string }>('POST', '/files', fd);
    },
  },
};
