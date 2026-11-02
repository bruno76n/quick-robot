// Business errors → HTTP; anything unexpected → generic message + errorId, never the trace (docs/11 A10).
import { BusinessError, type ErrorBody } from '@app/contract';
import type { Context } from 'hono';
import type { AppEnv } from '../env';

function isDiskFull(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === 'ENOSPC' || code === '53100';
}

export function onError(err: Error, c: Context<AppEnv>) {
  const deps = c.get('deps');
  const base = { requestId: c.get('requestId'), workspaceId: c.get('ctx')?.workspaceId, action: c.get('action'), path: c.req.path, method: c.req.method };
  if (err instanceof BusinessError) {
    const body: ErrorBody = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) };
    if (err.status >= 500) body.errorId = c.get('requestId');
    if (err.code === 'FORBIDDEN' || err.code === 'UNAUTHENTICATED') deps.logger.warn('access denied', { ...base, code: err.code });
    return c.json(body, err.status as 400);
  }
  const errorId = c.get('requestId') ?? deps.ids.next();
  if (isDiskFull(err)) {
    deps.logger.error('storage full', { ...base, errorId, err });
    return c.json({ code: 'STORAGE_FULL', message: 'No space left on device', errorId } satisfies ErrorBody, 507);
  }
  deps.logger.error('unexpected error', { ...base, errorId, err });
  return c.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error', errorId } satisfies ErrorBody, 500);
}
