// Like t(), but the filled parameters come back in bold (the mockup highlights figures inside sentences).
import { Fragment, type ReactNode } from 'react';
import { es } from './es';
import { fill, MissingParam, t, type Params } from './t';

export function tb(key: string, params: Params = {}): ReactNode {
  const text = t(key, params);
  if (text === es.common.genericText) return text;
  const marks: Params = {};
  const order: string[] = [];
  for (const name of Object.keys(params)) { marks[name] = `\uE000${order.length}\uE001`; order.push(name); }
  let template: string;
  try {
    // Fill with markers, then split on them and put back the formatted values in <b>.
    const raw = key.split('.').reduce<unknown>((o, k, i, all) => (o && typeof o === 'object' ? ((o as Record<string, unknown>)[all.slice(i).join('.')] ?? (o as Record<string, unknown>)[k]) : undefined), es);
    template = typeof raw === 'string' ? raw : '';
    const marked = template.replace(/\{([A-Za-z0-9_]+)\}/g, (m, n: string) => (n in marks ? String(marks[n]) : m));
    const filled = fill(marked, params);
    const parts = filled.split(/\uE000(\d+)\uE001/);
    return parts.map((p, i) => (i % 2 ? <b key={i}>{fill(`{${order[Number(p)]}}`, params)}</b> : <Fragment key={i}>{p}</Fragment>));
  } catch (e) {
    if (e instanceof MissingParam) return text;
    return text;
  }
}
