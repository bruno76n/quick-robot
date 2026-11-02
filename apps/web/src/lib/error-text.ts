import { es } from '../i18n/es';
import { ApiError } from './api';

/** Spanish text for any error coming from the API. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return es.errors[e.code];
  return es.errors.INTERNAL;
}
