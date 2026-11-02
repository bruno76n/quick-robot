// Sentences with some figures in bold (the mockup's brief, Inicio attentions, Gastos summary). Unlike tb(), the
// caller chooses which parameters go in bold and with which class (g = green, r = red, pos/neg).
import { Fragment, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { fill, MissingParam, t, type Params } from '../../i18n/t';

const TOKEN = /\{([A-Za-z0-9_]+)((?:\|[^{}|]*)*)\}/g;

function template(key: string): string | null {
  const v = key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), es);
  return typeof v === 'string' ? v : null;
}

/** t() with the parameters named in `bold` wrapped in <b className=…>. Plurals and choices stay plain. */
export function rt(key: string, params: Params, bold: Record<string, string> = {}): ReactNode {
  const tpl = template(key);
  if (tpl === null) return t(key, params);
  try {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of tpl.matchAll(TOKEN)) {
      if (m.index > last) out.push(tpl.slice(last, m.index));
      const [whole, name, opts] = m;
      const text = fill(whole, params);
      out.push(!opts && name! in bold ? <b key={m.index} className={bold[name!] || undefined}>{text}</b> : text);
      last = m.index + whole.length;
    }
    if (last < tpl.length) out.push(tpl.slice(last));
    return out.map((x, i) => (typeof x === 'string' ? <Fragment key={`s${i}`}>{x}</Fragment> : x));
  } catch (e) {
    if (e instanceof MissingParam) return t(key, params);
    throw e;
  }
}

/** All parameters in bold (no class). */
export const allBold = (...names: string[]) => Object.fromEntries(names.map((n) => [n, '']));
