/** Typed API client, written by hand over packages/contract. */
import {
  AddSpoolResult,
  Catalog,
  Catalogue,
  Channel,
  Collection,
  CostingContextDto,
  FilamentDetail,
  FilamentList,
  Printer,
  PrinterList,
  Product,
  SettingsBundle,
  Supplier,
  SupplyDetail,
  SupplyList,
  SpoolResult,
  Workspace,
  isErrorCode,
  type AddSpoolInput,
  type ChannelInput,
  type CollectionInput,
  type CompleteMaintenanceInput,
  type CreateSupplyInput,
  type ErrorCode,
  type MaintenanceTaskInput,
  type PrinterInput,
  type ProductInput,
  type SpoolMovementInput,
  type SupplierInput,
  type SupplyMovementInput,
  type SupplyPurchaseInput,
  type UpdateChannelInput,
  type UpdateSettingsInput,
  type UpdateSpoolInput,
  type UpdateSupplyInput,
} from '@app/contract';
import { z } from 'zod';
import { desktop } from './platform';

export class ApiError extends Error {
  readonly code: ErrorCode | 'network';
  readonly status: number;
  readonly details?: unknown;
  constructor(code: ErrorCode | 'network', status: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function base() {
  const info = desktop()?.serverInfo;
  return { url: `${info?.baseUrl ?? ''}/api/v1`, secret: info?.secret ?? (import.meta.env.VITE_APP_SECRET as string | undefined) };
}

async function request<T>(schema: z.ZodType<T>, path: string, init: RequestInit = {}): Promise<T> {
  return requestRaw(schema, path, init);
}

async function requestRaw<T>(schema: z.ZodType<T>, path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret } = base();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (secret) headers.set('x-app-secret', secret);
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError('network', 0, String(e));
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { code?: unknown; message?: unknown; details?: unknown } | null;
    throw new ApiError(isErrorCode(b?.code) ? b.code : 'INTERNAL', res.status, typeof b?.message === 'string' ? b.message : res.statusText, b?.details);
  }
  return schema.parse(body);
}

const Empty = z.null();
const Id = z.object({ id: z.string() });
const FileUp = z.object({ id: z.string(), url: z.string() });
const json = (method: string, data?: unknown): RequestInit => ({ method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
const enc = encodeURIComponent;

export const api = {
  workspace: { get: () => request(Workspace, '/workspace') },
  filaments: {
    list: () => request(FilamentList, '/filaments'),
    get: (id: string) => request(FilamentDetail, `/filaments/${encodeURIComponent(id)}`),
    addSpool: (input: AddSpoolInput) => request(AddSpoolResult, '/filaments/spools', { method: 'POST', body: JSON.stringify(input) }),
    updateSpool: (id: string, input: UpdateSpoolInput) => request(SpoolResult, `/filaments/spools/${enc(id)}`, json('PUT', input)),
    deleteSpool: (id: string) => request(z.object({ filamentId: z.string() }), `/filaments/spools/${enc(id)}`, json('DELETE')),
    restoreSpool: (id: string) => request(z.object({ filamentId: z.string() }), `/filaments/spools/${enc(id)}/restore`, json('POST')),
    recordMovement: (spoolId: string, input: SpoolMovementInput) => request(SpoolResult, `/filaments/spools/${enc(spoolId)}/movements`, json('POST', input)),
  },
  settings: {
    get: () => request(SettingsBundle, '/settings'),
    update: (input: UpdateSettingsInput) => request(SettingsBundle, '/settings', json('PATCH', input)),
    addChannel: (input: ChannelInput) => request(Channel, '/settings/channels', json('POST', input)),
    updateChannel: (id: string, input: UpdateChannelInput) => request(Channel, `/settings/channels/${enc(id)}`, json('PATCH', input)),
    removeChannel: (id: string) => request(Empty, `/settings/channels/${enc(id)}`, json('DELETE')),
    restoreChannel: (id: string) => request(Empty, `/settings/channels/${enc(id)}/restore`, json('POST')),
    catalog: () => request(Catalog, '/settings/catalog'),
  },
  suppliers: {
    list: () => request(z.array(Supplier), '/suppliers'),
    create: (input: SupplierInput) => request(Id, '/suppliers', json('POST', input)),
  },
  supplies: {
    list: () => request(SupplyList, '/supplies'),
    get: (id: string) => request(SupplyDetail, `/supplies/${enc(id)}`),
    create: (input: CreateSupplyInput) => request(SupplyDetail, '/supplies', json('POST', input)),
    update: (id: string, input: UpdateSupplyInput) => request(SupplyDetail, `/supplies/${enc(id)}`, json('PUT', input)),
    remove: (id: string) => request(Empty, `/supplies/${enc(id)}`, json('DELETE')),
    restore: (id: string) => request(Empty, `/supplies/${enc(id)}/restore`, json('POST')),
    purchase: (id: string, input: SupplyPurchaseInput) => request(SupplyDetail, `/supplies/${enc(id)}/purchases`, json('POST', input)),
    movement: (id: string, input: SupplyMovementInput) => request(SupplyDetail, `/supplies/${enc(id)}/movements`, json('POST', input)),
  },
  printers: {
    list: () => request(PrinterList, '/printers'),
    create: (input: PrinterInput) => request(Printer, '/printers', json('POST', input)),
    update: (id: string, input: PrinterInput) => request(Printer, `/printers/${enc(id)}`, json('PUT', input)),
    remove: (id: string) => request(Empty, `/printers/${enc(id)}`, json('DELETE')),
    restore: (id: string) => request(Empty, `/printers/${enc(id)}/restore`, json('POST')),
    addTask: (id: string, input: MaintenanceTaskInput) => request(Printer, `/printers/${enc(id)}/tasks`, json('POST', input)),
    updateTask: (taskId: string, input: MaintenanceTaskInput) => request(Printer, `/printers/tasks/${enc(taskId)}`, json('PUT', input)),
    removeTask: (taskId: string) => request(Empty, `/printers/tasks/${enc(taskId)}`, json('DELETE')),
    restoreTask: (taskId: string) => request(Empty, `/printers/tasks/${enc(taskId)}/restore`, json('POST')),
    completeTask: (taskId: string, input: CompleteMaintenanceInput) => request(Printer, `/printers/tasks/${enc(taskId)}/complete`, json('POST', input)),
  },
  products: {
    catalogue: () => request(Catalogue, '/products'),
    costingContext: () => request(CostingContextDto, '/products/costing-context'),
    create: (input: ProductInput) => request(Product, '/products', json('POST', input)),
    update: (id: string, input: ProductInput) => request(Product, `/products/${enc(id)}`, json('PUT', input)),
    saveVariant: (fromId: string, input: ProductInput) => request(Product, `/products/${enc(fromId)}/variants`, json('POST', input)),
    remove: (id: string) => request(Empty, `/products/${enc(id)}`, json('DELETE')),
    restore: (id: string) => request(Empty, `/products/${enc(id)}/restore`, json('POST')),
    setPhoto: (id: string, fileId: string | null) => request(Product, `/products/${enc(id)}/photo`, json('PUT', { fileId })),
  },
  collections: {
    create: (input: CollectionInput) => request(Collection, '/collections', json('POST', input)),
    update: (id: string, input: CollectionInput) => request(Collection, `/collections/${enc(id)}`, json('PUT', input)),
    remove: (id: string) => request(Empty, `/collections/${enc(id)}`, json('DELETE')),
    restore: (id: string) => request(Empty, `/collections/${enc(id)}/restore`, json('POST')),
  },
  files: {
    uploadImage: (file: Blob) => request(FileUp, '/files', { method: 'POST', body: file, headers: { 'content-type': file.type } }),
  },
};
