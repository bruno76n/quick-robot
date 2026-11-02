// t(key, params): the only text helper (docs/13 §2). Three forms: {name}, {count|singular|plural},
// {status|value=text|…}. Parameters are formatted by their suffix: …Cents money, …Grams grams, …Hours hours, …Pct %.
import { cents, grams, hours, listOf, pct } from '../lib/format';
import { es } from './es';

export type Params = Record<string, unknown>;
let reporter: (msg: string, info: Record<string, unknown>) => void = () => undefined;
/** Where missing parameters are reported (the app wires it to its log). */
export function onTextProblem(fn: typeof reporter) { reporter = fn; }

export function formatParam(name: string, value: unknown): string {
  if (Array.isArray(value)) return listOf(value.map((v) => formatParam(name, v)));
  if (typeof value === 'number') {
    const n = name.toLowerCase();
    if (n.endsWith('cents')) return cents(value);
    if (n.endsWith('grams')) return grams(value);
    if (n.endsWith('hours')) return hours(value);
    if (n.endsWith('pct')) return pct(value);
  }
  return String(value);
}

function lookup(key: string): unknown {
  const [section, ...rest] = key.split('.');
  const s = (es as Record<string, unknown>)[section!];
  if (s === undefined) return undefined;
  const flat = (s as Record<string, unknown>)[rest.join('.')];
  if (flat !== undefined) return flat;
  return rest.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), s);
}

export function has(key: string): boolean {
  return typeof lookup(key) === 'string';
}

export class MissingParam extends Error {}

/** Fill a template; throws MissingParam if a parameter is absent. */
export function fill(template: string, params: Params = {}): string {
  return template.replace(/\{([A-Za-z0-9_]+)((?:\|[^{}|]*)*)\}/g, (_m, name: string, rest: string) => {
    if (!(name in params) || params[name] === undefined || params[name] === null) throw new MissingParam(name);
    const value = params[name];
    if (!rest) return formatParam(name, value);
    const opts = rest.slice(1).split('|');
    if (opts.every((o) => o.includes('='))) {
      const hit = opts.find((o) => o.slice(0, o.indexOf('=')) === String(value));
      if (!hit) throw new MissingParam(`${name}=${String(value)}`);
      return hit.slice(hit.indexOf('=') + 1);
    }
    return Number(value) === 1 ? opts[0]! : (opts[1] ?? opts[0]!);
  });
}

export function t(key: string, params: Params = {}): string {
  const template = lookup(key);
  if (typeof template !== 'string') {
    reporter('missing text', { key });
    return es.common.genericText;
  }
  try {
    return fill(template, params);
  } catch (e) {
    reporter('missing text parameter', { key, param: e instanceof MissingParam ? e.message : 'unknown' });
    return es.common.genericText;
  }
}
