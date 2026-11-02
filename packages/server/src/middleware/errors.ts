import type { ErrorHandler } from 'hono';
import { BusinessError, errorHttpStatus, type ApiErrorBody } from '@app/contract';
import type { AppEnv } from '../env';

const isZodError = (e: unknown): e is { issues: unknown[] } =>
  typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ZodError' && Array.isArray((e as { issues?: unknown }).issues);

/** Business errors → HTTP with a stable `code`; anything else → 500 with an id the person can report. */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof BusinessError) return c.json(err.toBody(), errorHttpStatus[err.code]);
  if (isZodError(err)) {
    const body: ApiErrorBody = { code: 'VALIDATION_FAILED', message: 'Invalid input', details: err.issues };
    return c.json(body, 422);
  }
  const id = c.get('requestId') ?? 'unknown';
  console.error(JSON.stringify({ level: 'error', requestId: id, path: c.req.path, error: String(err instanceof Error ? (err.stack ?? err) : err) }));
  const body: ApiErrorBody = { code: 'INTERNAL', message: `Unexpected error (${id})`, details: { errorId: id } };
  return c.json(body, 500);
};
