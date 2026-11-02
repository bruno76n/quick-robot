// Fills a template where some parameters are nodes (a bold green amount, a link). Plain parameters are
// formatted like t() does; node parameters are placed where their bare {name} is (plural forms still read params).
import { Fragment, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { fill, type Params } from '../../i18n/t';

export function rich(template: string, params: Params, nodes: Record<string, ReactNode> = {}): ReactNode {
  const names = Object.keys(nodes);
  const marked = template.replace(/\{([A-Za-z0-9_]+)\}/g, (m, n: string) => (names.includes(n) ? `${names.indexOf(n)}` : m));
  let filled: string;
  try { filled = fill(marked, params); } catch { return es.common.genericText; }
  const parts = filled.split(/(\d+)/);
  return parts.map((p, i) => (i % 2 ? <Fragment key={i}>{nodes[names[Number(p)]!]}</Fragment> : <Fragment key={i}>{p}</Fragment>));
}
