// Ajustes › Copia de seguridad (docs/12 §10): export, import (own export or the mockup v7 backup), automatic backups,
// restore and "Vaciar negocio". Types mirror packages/server/src/usecases/workspace-data.ts.
import type { ErrorCode } from '@app/contract';
import { ApiError, request } from '../../lib/api';

export interface BackupInfo { id: string; on: string; sizeKb: number }
export interface ImportResult {
  format: 'workspace' | 'mockup-v7';
  counts: Record<string, number>;
  differences: string[];
  notes: string[];
  backupId: string | null;
}

/** The export is a file (not the usual `{ data }` envelope): bytes plus the name the server proposes. */
async function exportFile(): Promise<{ name: string; bytes: Uint8Array }> {
  let res: Response;
  try { res = await fetch('/api/v1/workspace/export', { credentials: 'same-origin' }); } catch { throw new ApiError('NETWORK_ERROR', 0); }
  if (!res.ok) {
    let json: { code?: ErrorCode; details?: Record<string, unknown>; errorId?: string } = {};
    try { json = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(json.code ?? (res.status >= 500 ? 'INTERNAL_ERROR' : 'NETWORK_ERROR'), res.status, json.details ?? {}, json.errorId);
  }
  const m = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '');
  return { name: m?.[1] ?? 'copia.json', bytes: new Uint8Array(await res.arrayBuffer()) };
}

export const backupApi = {
  exportFile,
  importFile: (file: Blob, name: string) => {
    const form = new FormData();
    form.set('file', file, name);
    form.set('confirm', 'true');
    return request<ImportResult>('POST', '/workspace/import', form);
  },
  list: () => request<BackupInfo[]>('GET', '/backups'),
  create: () => request<BackupInfo>('POST', '/backups'),
  restore: (id: string) => request<ImportResult>('POST', `/backups/${encodeURIComponent(id)}/restore`, { confirm: true }),
  clear: () => request<{ backupId: string }>('POST', '/workspace/clear', { confirm: true }),
};

/** Counts read from the chosen file, only to show them before confirming (the server validates everything). */
export interface FilePreview { products: number; customers: number; orders: number; sales: number }
export function previewBackup(text: string): FilePreview | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  if (o.tables && typeof o.tables === 'object') {
    const t = o.tables as Record<string, unknown>;
    return { products: len(t.product), customers: len(t.customer), orders: len(t.order), sales: len(t.sale) };
  }
  if (typeof o.v === 'number') return { products: len(o.productos), customers: len(o.clientes), orders: len(o.pedidos), sales: len(o.ventas) };
  return null;
}
