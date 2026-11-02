/** Typed API client, written by hand over packages/contract. */
import { AddSpoolResult, FilamentDetail, FilamentList, Workspace, isErrorCode, type AddSpoolInput, type ErrorCode } from '@app/contract';
import type { z } from 'zod';
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
  const { url, secret } = base();
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (secret) headers.set('x-app-secret', secret);
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError('network', 0, String(e));
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = body as { code?: unknown; message?: unknown; details?: unknown } | null;
    throw new ApiError(isErrorCode(b?.code) ? b.code : 'INTERNAL', res.status, typeof b?.message === 'string' ? b.message : res.statusText, b?.details);
  }
  return schema.parse(body);
}

export const api = {
  workspace: { get: () => request(Workspace, '/workspace') },
  filaments: {
    list: () => request(FilamentList, '/filaments'),
    get: (id: string) => request(FilamentDetail, `/filaments/${encodeURIComponent(id)}`),
    addSpool: (input: AddSpoolInput) => request(AddSpoolResult, '/filaments/spools', { method: 'POST', body: JSON.stringify(input) }),
  },
};
