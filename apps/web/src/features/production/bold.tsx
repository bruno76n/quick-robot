// Like tb(), but only the named parameters come back in bold (with an optional class, e.g. "r" for red),
// so a sentence can highlight some figures and not others, as the mockup does.
import { Fragment, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { fill, formatParam, t, type Params } from '../../i18n/t';

function template(key: string): string | undefined {
  const [section, ...rest] = key.split('.');
  const s = (es as Record<string, unknown>)[section!];
  const flat = s && typeof s === 'object' ? (s as Record<string, unknown>)[rest.join('.')] : undefined;
  if (typeof flat === 'string') return flat;
  const v = rest.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), s);
  return typeof v === 'string' ? v : undefined;
}

export function tbOnly(key: string, params: Params, bold: Record<string, string>): ReactNode {
  const tpl = template(key);
  if (!tpl) return t(key, params);
  const names = Object.keys(bold);
  try {
    const marked = tpl.replace(/\{([A-Za-z0-9_]+)\}/g, (m, n: string) => (names.includes(n) ? `${names.indexOf(n)}` : m));
    const parts = fill(marked, params).split(/(\d+)/);
    return parts.map((p, i) => {
      if (!(i % 2)) return <Fragment key={i}>{p}</Fragment>;
      const n = names[Number(p)]!;
      return <b key={i} className={bold[n] || undefined}>{formatParam(n, params[n])}</b>;
    });
  } catch {
    return t(key, params);
  }
}
