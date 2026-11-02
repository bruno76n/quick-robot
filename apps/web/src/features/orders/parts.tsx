// Small pieces shared by the board and the order page: status chip, place tags, layer bar and bold figures with color.
import { Fragment, type ReactNode } from 'react';
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { fill, t, type Params } from '../../i18n/t';
import { STATUS_TONE, type OrderStatus } from './api';
import { ORIGIN_ORDER, countText, originLabel, type Count, type OriginKind, type Tag } from './origins';

export const StatusChip = ({ status }: { status: OrderStatus }) => <Pill tone={STATUS_TONE[status]}>{es.status.order[status]}</Pill>;

/** Like tb(): parameters in bold, each with an optional class ("r" red, "g" green); `plain` leaves a parameter without bold. */
export function tbc(key: string, params: Params, cls: Record<string, string> = {}, plain: readonly string[] = []): ReactNode {
  const text = t(key, params);
  const raw = key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), es);
  if (typeof raw !== 'string') return text;
  const order: string[] = [];
  const marked = raw.replace(/\{([A-Za-z0-9_]+)\}/g, (m, n: string) => (n in params && !plain.includes(n) ? `\uE000${order.push(n) - 1}\uE001` : m));
  try {
    return fill(marked, params).split(/\uE000(\d+)\uE001/).map((p, i) => {
      if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
      const name = order[Number(p)]!;
      return <b key={i} className={cls[name]}>{fill(`{${name}}`, params)}</b>;
    });
  } catch {
    return text;
  }
}

export const OriginTag = ({ tag }: { tag: Pick<Tag, 'k' | 'n'> }) => <span className={`tg ${tag.k}`}><b className="num">{tag.n}</b>{originLabel(tag.k, tag.n)}</span>;

export function Capas({ count, sm }: { count: Count; sm?: boolean }) {
  const ks = ORIGIN_ORDER.filter((k) => (count[k] ?? 0) > 0);
  if (!ks.length) return null;
  return <span className={`capas${sm ? ' sm' : ''}`} role="img" aria-label={countText(count)}>{ks.map((k) => <i key={k} className={k} style={{ flex: count[k] }} />)}</span>;
}

export function CapasLegend({ count }: { count: Count }) {
  return <ul className="lg">{ORIGIN_ORDER.filter((k) => (count[k] ?? 0) > 0).map((k: OriginKind) => <li key={k}><i className={k} /><b className="num">{count[k]}</b> {originLabel(k, count[k]!)}</li>)}</ul>;
}

export function Where({ tags }: { tags: readonly Tag[] }) {
  return <>{tags.map((tg, i) => (
    <div className="dn" key={i}>
      <OriginTag tag={tg} />
      {tg.k === 'print' ? <span className="prog mini" role="img" aria-label={t('screens.order.printedAria', { n: tg.pct ?? 0 })}><i style={{ width: `${tg.pct ?? 0}%` }} /></span> : null}
      {tg.s ? <small>{tg.s}</small> : null}
    </div>
  ))}</>;
}
