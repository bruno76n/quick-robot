import type { ErrorHandler } from 'hono';
import { BusinessError, errorHttpStatus, type ApiErrorBody } from '@app/contract';
import type { AppEnv } from '../env';
import type { Logger } from '../logging';

const isZodError = (e: unknown): e is { issues: unknown[] } =>
  typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ZodError' && Array.isArray((e as { issues?: unknown }).issues);

/** Business errors → HTTP with a stable `code`; anything else → 500 with an id the person can report. */
/**
 * Fails closed with a generic message (docs/11 · A10): never a stack trace or database detail. Validation
 * errors only say which field and why (path + code), never echo the input.
 */
export const errorHandler =
  (logger: Logger): ErrorHandler<AppEnv> =>
  (err, c) => {
    if (err instanceof BusinessError) {
      const body = err.toBody();
      // Messages of business errors are technical (English) and safe; details only for codes that carry numbers.
      return c.json(body, errorHttpStatus[err.code]);
    }
    if (isZodError(err)) {
      const issues = (err.issues as { path?: unknown[]; code?: string }[]).slice(0, 20).map((i) => ({ path: (i.path ?? []).map(String).join('.'), code: i.code ?? 'invalid' }));
      const body: ApiErrorBody = { code: 'VALIDATION_FAILED', message: 'Invalid input', details: issues };
      return c.json(body, 422);
    }
    const id = c.get('requestId') ?? 'unknown';
    logger.log({ level: 'error', msg: 'unexpected error', requestId: id, path: c.req.path, error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    const body: ApiErrorBody = { code: 'INTERNAL', message: `Unexpected error (${id})`, details: { errorId: id } };
    return c.json(body, 500);
  };
