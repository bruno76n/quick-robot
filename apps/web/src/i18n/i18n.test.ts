// docs/13 §10: every code of docs/12 §2 has its text; no empty texts; every {x} exists in details;
// no text writes the unit of a …Cents/…Grams/…Hours/…Pct parameter by hand.
import { ERROR_DETAILS, ERRORS, WARNING_DETAILS, WARNINGS } from '@app/contract';
import { describe, expect, it } from 'vitest';
import { es } from './es';

const params = (s: string) => [...s.matchAll(/\{([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
const strings = (o: unknown, prefix = ''): [string, string][] =>
  typeof o === 'string' ? [[prefix, o]] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k)) : [];

describe('i18n', () => {
  it('every error code of docs/12 has a text, and nothing else is there', () => {
    expect(Object.keys(es.errors).sort()).toEqual(Object.keys(ERRORS).sort());
  });

  it('every warning code has a text', () => {
    expect(Object.keys(es.warnings).sort()).toEqual([...WARNINGS].sort());
  });

  it('no empty texts in toast, errors, warnings, fields, confirm, status and screens', () => {
    for (const section of ['toast', 'errors', 'warnings', 'fields', 'confirm', 'status', 'screens', 'errorParts', 'errorVariants'] as const) {
      for (const [k, v] of strings(es[section])) expect(v.trim(), `${section}.${k}`).not.toBe('');
    }
  });

  it('every {param} of an error or warning exists in its details (also the first of each plural or choice)', () => {
    for (const [code, text] of Object.entries(es.errors)) {
      const allowed = new Set([...ERROR_DETAILS[code as keyof typeof ERRORS], 'errorId']);
      for (const p of params(text)) expect(allowed.has(p), `${code}: {${p}}`).toBe(true);
    }
    for (const [code, parts] of Object.entries(es.errorParts)) {
      const allowed = new Set([...ERROR_DETAILS[code as keyof typeof ERRORS], 'errorId']);
      for (const [, text] of strings(parts)) for (const p of params(text)) expect(allowed.has(p), `${code}: {${p}}`).toBe(true);
    }
    for (const [code, text] of Object.entries(es.warnings)) {
      const allowed = new Set(WARNING_DETAILS[code as (typeof WARNINGS)[number]]);
      for (const p of params(text)) expect(allowed.has(p), `${code}: {${p}}`).toBe(true);
    }
  });

  it('no text writes the unit after a formatted parameter', () => {
    for (const [k, v] of strings(es)) {
      expect(v, k).not.toMatch(/\{[A-Za-z]*(Cents|Grams|grams)\}\s*(g|\$|MXN)\b/);
      expect(v, k).not.toMatch(/\$\{[A-Za-z]*Cents\}/);
      expect(v, k).not.toMatch(/\{[A-Za-z]*Hours\}\s*h\b/);
      expect(v, k).not.toMatch(/\{[A-Za-z]*Pct\}\s*%/);
    }
  });

  it('every toast with Deshacer exists', () => {
    for (const k of es.toastWithUndo) expect(es.toast[k as keyof typeof es.toast]).toBeTruthy();
  });

  it('the fixed vocabulary is not replaced by synonyms', () => {
    for (const [k, v] of strings(es)) expect(v, k).not.toMatch(/\b(Importe|Utilidad|Stock)\b/);
  });
});
