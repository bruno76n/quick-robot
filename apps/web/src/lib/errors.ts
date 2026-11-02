// Turns an API error into the Spanish text of docs/13; the technical message is never shown.
import type { FieldError } from '@app/contract';
import { es } from '../i18n/es';
import { has, t } from '../i18n/t';
import { ApiError } from './api';
import { isDesktop } from './platform';

type Parts = Record<string, Record<string, string>>;

export function errorText(err: unknown): { text: string; lines: string[] } {
  if (!(err instanceof ApiError)) return { text: t('errors.INTERNAL_ERROR', { errorId: '—' }), lines: [] };
  const variants = es.errorVariants as Record<string, { desktop: string; cloud: string }>;
  const v = variants[err.code];
  if (v) return { text: isDesktop() || err.code === 'UNAUTHENTICATED' ? v.desktop : v.cloud, lines: [] };
  const d: Record<string, unknown> = { ...err.details, ...(err.errorId ? { errorId: err.errorId } : {}) };
  const parts = (es.errorParts as Parts)[err.code];
  if (parts && typeof d.reason === 'string' && parts[d.reason]) return { text: t(`errorParts.${err.code}.${d.reason}`, d), lines: [] };
  const text = has(`errors.${err.code}`) ? t(`errors.${err.code}`, d) : t('errors.INTERNAL_ERROR', { errorId: err.errorId ?? '—' });
  const lines: string[] = [];
  if (parts?.item && Array.isArray(d.items)) for (const it of d.items as Record<string, unknown>[]) lines.push(t(`errorParts.${err.code}.item`, it));
  if (parts?.detail && d.reason) lines.push(String(d.reason));
  return { text, lines };
}

/** Field message: fields['<form>.<field>.<rule>'], then fields['<rule>'], then fields.required (docs/13 §2). */
export function fieldText(form: string, f: FieldError): string {
  const field = f.path.split(/[.[]/)[0];
  const specific = `fields.${form}.${field}.${f.rule}`;
  if (has(specific)) return t(specific, f.params ?? {});
  if (has(`fields.${f.rule}`)) return t(`fields.${f.rule}`, f.params ?? {});
  return t('fields.required');
}

export function fieldErrors(err: unknown): FieldError[] {
  return err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details.fields) ? (err.details.fields as FieldError[]) : [];
}
