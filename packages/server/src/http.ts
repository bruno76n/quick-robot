// Request parsing and response helpers. Input is validated with Zod at the edge (docs/11 A05).
import { BusinessError, toFieldErrors, type Warning } from '@app/contract';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from './env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ok<T>(c: Context<AppEnv>, data: T, status: 200 | 201 = 200, warnings: Warning[] = []) {
  const all = [...(c.get('warnings') ?? []), ...warnings];
  return c.json(all.length ? { data, warnings: all } : { data }, status);
}

export function noContent(c: Context<AppEnv>) {
  return c.body(null, 204);
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new BusinessError('VALIDATION_ERROR', { fields: toFieldErrors(r.error) }, 'Invalid input');
  return r.data;
}

export async function body<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: '', rule: 'invalid_format' }] }, 'Body is not valid JSON');
  }
  return parse(schema, raw);
}

/** A body that may be left out (an empty request is `{}`); when present it must be valid JSON. */
export async function optionalBody<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.infer<S>> {
  const text = await c.req.text();
  if (!text.trim()) return parse(schema, {});
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: '', rule: 'invalid_format' }] }, 'Body is not valid JSON'); }
  return parse(schema, raw);
}

export function query<S extends z.ZodType>(c: Context<AppEnv>, schema: S): z.infer<S> {
  return parse(schema, c.req.query());
}

/** An id that is not a UUID can never exist: 404 before touching the database (docs/12 §1). */
export function idParam(c: Context<AppEnv>, name: string, entity: string): string {
  const v = c.req.param(name) ?? '';
  if (!UUID.test(v)) throw new BusinessError('NOT_FOUND', { entity }, 'Not found');
  return v.toLowerCase();
}

export function notFound(entity: string): BusinessError {
  return new BusinessError('NOT_FOUND', { entity }, 'Not found');
}
